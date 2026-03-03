import { Router } from 'express';
import { getSettings, saveSettings } from './settings.js';
import { getPool, resetPool, testConnection } from './db.js';
import { testShopifyConnection } from './shopify.js';
import {
  runSync,
  getSyncRuns,
  getSyncLogs,
  getDataCounts,
  getSyncCursors,
  resetSyncCursors,
} from './sync.js';
import {
  getCronConfig,
  updateCronSchedule,
  setCronEnabled,
  startCronFromDb,
} from './cronManager.js';
import { runSchema } from './schema.js';

const router = Router();

function isDbNotReadyError(e) {
  const msg = (e && e.message) || '';
  const code = e && e.code;
  return (
    code === '42P01' ||
    /relation ".*" does not exist/i.test(msg) ||
    /database (url )?not configured/i.test(msg) ||
    /connect/i.test(msg)
  );
}

// ==================== SETTINGS ====================

router.get('/api/settings', (req, res) => {
  const s = getSettings();
  res.json({
    databaseUrl: s.databaseUrl ? '••••••••' : '',
    shopify: {
      store: s.shopify.store,
      accessToken: s.shopify.accessToken ? '••••••••' : '',
    },
  });
});

const MASK = '••••••••';
function isMasked(v) {
  return !v || v === MASK || (typeof v === 'string' && v.replace(/\*/g, '') === '');
}

router.post('/api/settings', async (req, res) => {
  try {
    const { databaseUrl, shopify } = req.body || {};
    const current = getSettings();
    const updates = {};
    if (databaseUrl !== undefined && databaseUrl !== '' && !isMasked(databaseUrl)) {
      updates.databaseUrl = databaseUrl;
    }
    if (shopify) {
      updates.shopify = {
        store: shopify.store !== undefined ? shopify.store : current.shopify.store,
        accessToken:
          shopify.accessToken !== undefined && !isMasked(shopify.accessToken)
            ? shopify.accessToken
            : current.shopify.accessToken,
      };
    }
    saveSettings(updates);
    if (updates.databaseUrl) {
      resetPool();
      await startCronFromDb();
    }
    const s = getSettings();
    res.json({
      ok: true,
      databaseUrl: s.databaseUrl ? MASK : '',
      shopify: {
        store: s.shopify.store,
        accessToken: s.shopify.accessToken ? MASK : '',
      },
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/settings/test-db', async (req, res) => {
  try {
    const url = req.body?.connectionString || req.body?.databaseUrl || getSettings().databaseUrl;
    if (!url) return res.status(400).json({ ok: false, error: 'No connection string' });
    const ok = await testConnection(url);
    res.json({ ok });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

router.post('/api/init-db', async (req, res) => {
  try {
    const url = req.body?.connectionString || req.body?.databaseUrl || getSettings().databaseUrl;
    if (!url) return res.status(400).json({ ok: false, error: 'No connection string' });
    await runSchema(url);
    saveSettings({ databaseUrl: url });
    resetPool();
    await startCronFromDb();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/api/settings/test-shopify', async (req, res) => {
  try {
    const { store, accessToken } = req.body || {};
    const s = getSettings();
    const result = await testShopifyConnection(
      store || s.shopify.store,
      accessToken || s.shopify.accessToken
    );
    res.json(result);
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ==================== SYNC ====================

router.post('/api/sync/run', async (req, res) => {
  try {
    const forceFullSync = req.body?.forceFullSync === true || req.body?.type === 'full';
    // Respond immediately, run sync in background
    res.json({ ok: true, message: 'Sync started in background', forceFullSync });
    // Run async - don't await
    runSync({ forceFullSync }).catch((e) => {
      console.error('Background sync error:', e.message);
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/sync/stop', async (req, res) => {
  try {
    const pool = getPool();
    const { rowCount } = await pool.query(
      `UPDATE sync_runs SET status = 'failed', finished_at = COALESCE(finished_at, NOW()), error_message = COALESCE(error_message, 'Stopped from UI') WHERE status = 'running'`
    );
    res.json({ ok: true, stopped: rowCount });
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json({ ok: true, stopped: 0 });
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/sync/runs', async (req, res) => {
  try {
    const runs = await getSyncRuns(Number(req.query.limit) || 50);
    res.json(runs);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/sync/logs/:runId', async (req, res) => {
  try {
    const logs = await getSyncLogs(Number(req.params.runId), Number(req.query.after) || 0);
    res.json(logs);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/sync/counts', async (req, res) => {
  try {
    const counts = await getDataCounts();
    res.json(counts);
  } catch (e) {
    if (isDbNotReadyError(e)) {
      return res.json({ orders: 0, order_line_items: 0, products: 0, variants: 0, customers: 0, collections: 0 });
    }
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/sync/cursors', async (req, res) => {
  try {
    const cursors = await getSyncCursors();
    res.json(cursors);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/sync/cursors/reset', async (req, res) => {
  try {
    await resetSyncCursors();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== CRON ====================

const defaultCronConfig = { schedule: '0 * * * *', enabled: true, last_run_at: null };

router.get('/api/cron', async (req, res) => {
  try {
    const config = await getCronConfig();
    res.json(config || defaultCronConfig);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json(defaultCronConfig);
    res.status(500).json({ error: e.message });
  }
});

router.put('/api/cron', async (req, res) => {
  try {
    const { schedule, enabled } = req.body || {};
    if (schedule !== undefined) await updateCronSchedule(schedule);
    if (enabled !== undefined) await setCronEnabled(!!enabled);
    const config = await getCronConfig();
    res.json(config || { schedule: '0 * * * *', enabled: true, last_run_at: null });
  } catch (e) {
    if (isDbNotReadyError(e)) {
      return res.status(503).json({
        error:
          'Database not initialized. Go to Settings and click "Initialize database" to create tables, then you can save the schedule.',
      });
    }
    res.status(500).json({ error: e.message });
  }
});

// ==================== ANALYTICS ====================

router.get('/api/analytics', async (req, res) => {
  try {
    const pool = getPool();
    const from = req.query.from || '2020-01-01';
    const to = req.query.to || new Date().toISOString().split('T')[0];
    const toEnd = to + 'T23:59:59Z';

    const dateFilter = `created_at >= $1 AND created_at <= $2`;
    const params = [from, toEnd];

    // Run all queries in parallel
    const [
      ordersOverTime,
      revenueOverTime,
      financialStatus,
      fulfillmentStatus,
      summary,
      topProducts,
      dailyBreakdown,
    ] = await Promise.all([
      // Orders per day
      pool.query(
        `SELECT DATE(created_at) as date, COUNT(*)::int as count
         FROM shopify_orders WHERE ${dateFilter}
         GROUP BY DATE(created_at) ORDER BY date`, params
      ),
      // Revenue per day
      pool.query(
        `SELECT DATE(created_at) as date, COALESCE(SUM(total_price),0) as revenue
         FROM shopify_orders WHERE ${dateFilter}
         GROUP BY DATE(created_at) ORDER BY date`, params
      ),
      // Financial status breakdown
      pool.query(
        `SELECT COALESCE(financial_status, 'unknown') as status, COUNT(*)::int as count
         FROM shopify_orders WHERE ${dateFilter}
         GROUP BY financial_status ORDER BY count DESC`, params
      ),
      // Fulfillment status breakdown
      pool.query(
        `SELECT COALESCE(fulfillment_status, 'unfulfilled') as status, COUNT(*)::int as count
         FROM shopify_orders WHERE ${dateFilter}
         GROUP BY fulfillment_status ORDER BY count DESC`, params
      ),
      // Summary stats
      pool.query(
        `SELECT
           COUNT(*)::int as total_orders,
           COALESCE(SUM(total_price),0) as total_revenue,
           COALESCE(AVG(total_price),0) as avg_order_value,
           COUNT(*) FILTER (WHERE financial_status = 'paid')::int as paid_orders,
           COUNT(*) FILTER (WHERE financial_status = 'pending')::int as pending_orders,
           COUNT(*) FILTER (WHERE financial_status = 'refunded' OR financial_status = 'partially_refunded')::int as refunded_orders,
           COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL)::int as cancelled_orders,
           COUNT(*) FILTER (WHERE fulfillment_status = 'fulfilled')::int as fulfilled_orders,
           COUNT(*) FILTER (WHERE fulfillment_status IS NULL OR fulfillment_status = 'unfulfilled' OR fulfillment_status = '')::int as unfulfilled_orders
         FROM shopify_orders WHERE ${dateFilter}`, params
      ),
      // Top products by quantity sold
      pool.query(
        `SELECT li.title, SUM(li.quantity)::int as total_qty, SUM(li.price * li.quantity) as total_revenue
         FROM shopify_order_line_items li
         JOIN shopify_orders o ON o.id = li.order_id
         WHERE o.${dateFilter}
         GROUP BY li.title ORDER BY total_qty DESC LIMIT 10`, params
      ),
      // Daily breakdown for table
      pool.query(
        `SELECT
           DATE(created_at) as date,
           COUNT(*)::int as orders,
           COALESCE(SUM(total_price),0) as revenue,
           COALESCE(AVG(total_price),0) as avg_value,
           COUNT(*) FILTER (WHERE financial_status = 'paid')::int as paid,
           COUNT(*) FILTER (WHERE financial_status = 'pending')::int as pending,
           COUNT(*) FILTER (WHERE financial_status = 'refunded' OR financial_status = 'partially_refunded')::int as refunded
         FROM shopify_orders WHERE ${dateFilter}
         GROUP BY DATE(created_at) ORDER BY date DESC LIMIT 60`, params
      ),
    ]);

    res.json({
      ordersOverTime: ordersOverTime.rows,
      revenueOverTime: revenueOverTime.rows,
      financialStatus: financialStatus.rows,
      fulfillmentStatus: fulfillmentStatus.rows,
      summary: summary.rows[0] || {},
      topProducts: topProducts.rows,
      dailyBreakdown: dailyBreakdown.rows,
    });
  } catch (e) {
    if (isDbNotReadyError(e)) {
      return res.json({
        ordersOverTime: [], revenueOverTime: [], financialStatus: [],
        fulfillmentStatus: [], summary: {}, topProducts: [], dailyBreakdown: [],
      });
    }
    res.status(500).json({ error: e.message });
  }
});

// ==================== ANALYTICS PRO ====================

router.get('/api/analytics/pro', async (req, res) => {
  try {
    const pool = getPool();
    const from = req.query.from || '2020-01-01';
    const to = req.query.to || new Date().toISOString().split('T')[0];
    const toEnd = to + 'T23:59:59Z';
    const params = [from, toEnd];
    const df = `created_at >= $1 AND created_at <= $2`;
    const odf = `o.created_at >= $1 AND o.created_at <= $2`;

    // Calculate previous period for comparison
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const periodDays = Math.ceil((toDate - fromDate) / 86400000);
    const prevFrom = new Date(fromDate.getTime() - periodDays * 86400000).toISOString().split('T')[0];
    const prevTo = new Date(fromDate.getTime() - 86400000).toISOString().split('T')[0];
    const prevParams = [prevFrom, prevTo + 'T23:59:59Z'];

    const [
      currentSummary,
      prevSummary,
      ordersOverTime,
      revenueOverTime,
      financialStatus,
      fulfillmentStatus,
      hourlyOrders,
      dayOfWeekOrders,
      topCities,
      topStates,
      orderValueDist,
      topProducts,
      productTypes,
      customerAcquisition,
      newVsReturning,
      recentOrders,
    ] = await Promise.all([
      // Current period summary
      pool.query(`SELECT
        COUNT(*)::int as total_orders,
        COALESCE(SUM(subtotal_price),0)::numeric as gross_sales,
        COALESCE(SUM(total_discounts),0)::numeric as discounts,
        COALESCE(SUM(total_price) FILTER (WHERE financial_status IN ('refunded','partially_refunded')),0)::numeric as returns,
        COALESCE(SUM(total_tax),0)::numeric as taxes,
        COALESCE(SUM(total_price),0)::numeric as total_sales,
        COALESCE(AVG(total_price),0)::numeric as avg_order_value,
        COUNT(DISTINCT email) FILTER (WHERE email IS NOT NULL AND email != '')::int as unique_customers,
        COUNT(*) FILTER (WHERE financial_status = 'paid')::int as paid_orders,
        COUNT(*) FILTER (WHERE financial_status = 'pending')::int as pending_orders,
        COUNT(*) FILTER (WHERE financial_status IN ('refunded','partially_refunded'))::int as refunded_orders,
        COUNT(*) FILTER (WHERE financial_status = 'voided')::int as voided_orders,
        COUNT(*) FILTER (WHERE cancelled_at IS NOT NULL)::int as cancelled_orders,
        COUNT(*) FILTER (WHERE fulfillment_status = 'fulfilled')::int as fulfilled_orders,
        COALESCE(MAX(total_price),0)::numeric as max_order_value
      FROM shopify_orders WHERE ${df}`, params),
      // Previous period summary for comparison
      pool.query(`SELECT
        COUNT(*)::int as total_orders,
        COALESCE(SUM(subtotal_price),0)::numeric as gross_sales,
        COALESCE(SUM(total_discounts),0)::numeric as discounts,
        COALESCE(SUM(total_price) FILTER (WHERE financial_status IN ('refunded','partially_refunded')),0)::numeric as returns,
        COALESCE(SUM(total_price),0)::numeric as total_sales,
        COALESCE(AVG(total_price),0)::numeric as avg_order_value,
        COUNT(DISTINCT email) FILTER (WHERE email IS NOT NULL AND email != '')::int as unique_customers,
        COUNT(*) FILTER (WHERE fulfillment_status = 'fulfilled')::int as fulfilled_orders
      FROM shopify_orders WHERE ${df}`, prevParams),
      // Orders over time
      pool.query(`SELECT DATE(created_at) as date, COUNT(*)::int as count,
        COALESCE(SUM(total_price),0)::numeric as revenue
        FROM shopify_orders WHERE ${df}
        GROUP BY DATE(created_at) ORDER BY date`, params),
      // Revenue over time with cumulative
      pool.query(`SELECT DATE(created_at) as date,
        COALESCE(SUM(total_price),0)::numeric as revenue,
        SUM(COALESCE(SUM(total_price),0)) OVER (ORDER BY DATE(created_at))::numeric as cumulative
        FROM shopify_orders WHERE ${df}
        GROUP BY DATE(created_at) ORDER BY date`, params),
      // Financial status
      pool.query(`SELECT COALESCE(financial_status, 'unknown') as status, COUNT(*)::int as count,
        COALESCE(SUM(total_price),0)::numeric as revenue
        FROM shopify_orders WHERE ${df}
        GROUP BY financial_status ORDER BY count DESC`, params),
      // Fulfillment status
      pool.query(`SELECT COALESCE(fulfillment_status, 'unfulfilled') as status, COUNT(*)::int as count
        FROM shopify_orders WHERE ${df}
        GROUP BY fulfillment_status ORDER BY count DESC`, params),
      // Orders by hour of day
      pool.query(`SELECT EXTRACT(HOUR FROM created_at)::int as hour, COUNT(*)::int as count,
        COALESCE(SUM(total_price),0)::numeric as revenue
        FROM shopify_orders WHERE ${df}
        GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY hour`, params),
      // Orders by day of week
      pool.query(`SELECT EXTRACT(DOW FROM created_at)::int as dow, COUNT(*)::int as count,
        COALESCE(SUM(total_price),0)::numeric as revenue
        FROM shopify_orders WHERE ${df}
        GROUP BY EXTRACT(DOW FROM created_at) ORDER BY dow`, params),
      // Top cities
      pool.query(`SELECT c.city, COUNT(o.id)::int as orders, COALESCE(SUM(o.total_price),0)::numeric as revenue
        FROM shopify_orders o
        JOIN shopify_customers c ON c.email = o.email
        WHERE ${odf} AND c.city IS NOT NULL AND c.city != ''
        GROUP BY c.city ORDER BY orders DESC LIMIT 10`, params),
      // Top states/provinces
      pool.query(`SELECT c.province as state, COUNT(o.id)::int as orders, COALESCE(SUM(o.total_price),0)::numeric as revenue
        FROM shopify_orders o
        JOIN shopify_customers c ON c.email = o.email
        WHERE ${odf} AND c.province IS NOT NULL AND c.province != ''
        GROUP BY c.province ORDER BY orders DESC LIMIT 10`, params),
      // Order value distribution (histogram buckets)
      pool.query(`SELECT
        CASE
          WHEN total_price < 500 THEN '₹0-500'
          WHEN total_price < 1000 THEN '₹500-1K'
          WHEN total_price < 2000 THEN '₹1K-2K'
          WHEN total_price < 3000 THEN '₹2K-3K'
          WHEN total_price < 5000 THEN '₹3K-5K'
          WHEN total_price < 10000 THEN '₹5K-10K'
          ELSE '₹10K+'
        END as bucket,
        COUNT(*)::int as count,
        COALESCE(SUM(total_price),0)::numeric as revenue
        FROM shopify_orders WHERE ${df} AND total_price IS NOT NULL
        GROUP BY bucket
        ORDER BY MIN(total_price)`, params),
      // Top products with revenue
      pool.query(`SELECT li.title, SUM(li.quantity)::int as qty, 
        COALESCE(SUM(li.price * li.quantity),0)::numeric as revenue,
        COUNT(DISTINCT li.order_id)::int as order_count
        FROM shopify_order_line_items li
        JOIN shopify_orders o ON o.id = li.order_id
        WHERE ${odf}
        GROUP BY li.title ORDER BY revenue DESC LIMIT 15`, params),
      // Product type breakdown
      pool.query(`SELECT COALESCE(p.product_type, 'Other') as type,
        COUNT(DISTINCT li.order_id)::int as orders,
        SUM(li.quantity)::int as qty,
        COALESCE(SUM(li.price * li.quantity),0)::numeric as revenue
        FROM shopify_order_line_items li
        JOIN shopify_products p ON p.id = li.product_id
        JOIN shopify_orders o ON o.id = li.order_id
        WHERE ${odf}
        GROUP BY p.product_type ORDER BY revenue DESC LIMIT 8`, params),
      // Customer acquisition over time
      pool.query(`SELECT DATE(created_at) as date, COUNT(*)::int as new_customers
        FROM shopify_customers WHERE ${df}
        GROUP BY DATE(created_at) ORDER BY date`, params),
      // New vs returning (approximate via orders_count)
      pool.query(`SELECT
        COUNT(*) FILTER (WHERE c.orders_count <= 1)::int as new_customers,
        COUNT(*) FILTER (WHERE c.orders_count > 1)::int as returning_customers,
        COALESCE(SUM(o.total_price) FILTER (WHERE c.orders_count <= 1),0)::numeric as new_revenue,
        COALESCE(SUM(o.total_price) FILTER (WHERE c.orders_count > 1),0)::numeric as returning_revenue
        FROM shopify_orders o
        LEFT JOIN shopify_customers c ON c.email = o.email
        WHERE ${odf}`, params),
      // Recent high-value orders
      pool.query(`SELECT id, order_number, name, email, total_price, financial_status, fulfillment_status, created_at
        FROM shopify_orders WHERE ${df}
        ORDER BY total_price DESC NULLS LAST LIMIT 10`, params),
    ]);

    res.json({
      summary: currentSummary.rows[0] || {},
      prevSummary: prevSummary.rows[0] || {},
      periodDays,
      ordersOverTime: ordersOverTime.rows,
      revenueOverTime: revenueOverTime.rows,
      financialStatus: financialStatus.rows,
      fulfillmentStatus: fulfillmentStatus.rows,
      hourlyOrders: hourlyOrders.rows,
      dayOfWeekOrders: dayOfWeekOrders.rows,
      topCities: topCities.rows,
      topStates: topStates.rows,
      orderValueDist: orderValueDist.rows,
      topProducts: topProducts.rows,
      productTypes: productTypes.rows,
      customerAcquisition: customerAcquisition.rows,
      newVsReturning: newVsReturning.rows[0] || {},
      recentOrders: recentOrders.rows,
    });
  } catch (e) {
    if (isDbNotReadyError(e)) {
      return res.json({
        summary: {}, prevSummary: {}, ordersOverTime: [], revenueOverTime: [],
        financialStatus: [], fulfillmentStatus: [], hourlyOrders: [], dayOfWeekOrders: [],
        topCities: [], topStates: [], orderValueDist: [], topProducts: [], productTypes: [],
        customerAcquisition: [], newVsReturning: {}, recentOrders: [], periodDays: 30
      });
    }
    res.status(500).json({ error: e.message });
  }
});

// ==================== DATA ====================

// Whitelist of sortable columns per table to prevent SQL injection
const SORTABLE = {
  orders: ['id', 'order_number', 'name', 'email', 'total_price', 'subtotal_price', 'currency', 'financial_status', 'fulfillment_status', 'created_at', 'updated_at'],
  line_items: ['id', 'order_id', 'product_id', 'title', 'variant_title', 'sku', 'quantity', 'price', 'total_discount', 'fulfillment_status'],
  products: ['id', 'title', 'handle', 'vendor', 'product_type', 'status', 'tags', 'created_at', 'updated_at'],
  variants: ['id', 'product_id', 'title', 'sku', 'barcode', 'price', 'compare_at_price', 'inventory_quantity', 'weight'],
  customers: ['id', 'email', 'first_name', 'last_name', 'phone', 'orders_count', 'total_spent', 'state', 'city', 'province', 'country', 'zip', 'created_at', 'updated_at'],
  collections: ['id', 'title', 'handle', 'collection_type', 'sort_order', 'published_at', 'created_at', 'updated_at'],
};

function parseSortParams(query, entity) {
  const allowed = SORTABLE[entity] || [];
  let col = (query.sort_by || '').toLowerCase();
  if (!allowed.includes(col)) col = 'created_at';
  // Fallback for tables without created_at
  if (!allowed.includes(col)) col = 'id';
  const dir = (query.sort_dir || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return { col, dir };
}

router.get('/api/orders', async (req, res) => {
  try {
    const pool = getPool();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search || '';
    const { col, dir } = parseSortParams(req.query, 'orders');
    let where = '';
    const params = [limit, offset];
    if (search) {
      where = `WHERE email ILIKE $3 OR name ILIKE $3 OR CAST(order_number AS TEXT) LIKE $3`;
      params.push(`%${search}%`);
    }
    const { rows } = await pool.query(
      `SELECT id, order_number, name, email, total_price, subtotal_price, currency, financial_status, fulfillment_status, created_at, updated_at
       FROM shopify_orders ${where} ORDER BY ${col} ${dir} NULLS LAST LIMIT $1 OFFSET $2`,
      params
    );
    res.json(rows);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/orders/:id/line-items', async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT * FROM shopify_order_line_items WHERE order_id = $1 ORDER BY id',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/products', async (req, res) => {
  try {
    const pool = getPool();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search || '';
    const { col, dir } = parseSortParams(req.query, 'products');
    let where = '';
    const params = [limit, offset];
    if (search) {
      where = `WHERE title ILIKE $3 OR handle ILIKE $3 OR vendor ILIKE $3 OR tags ILIKE $3`;
      params.push(`%${search}%`);
    }
    const { rows } = await pool.query(
      `SELECT id, title, handle, vendor, product_type, status, tags, created_at, updated_at
       FROM shopify_products ${where} ORDER BY ${col} ${dir} NULLS LAST LIMIT $1 OFFSET $2`,
      params
    );
    res.json(rows);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/products/:id/variants', async (req, res) => {
  try {
    const pool = getPool();
    const { rows } = await pool.query(
      'SELECT * FROM shopify_product_variants WHERE product_id = $1 ORDER BY position',
      [req.params.id]
    );
    res.json(rows);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/customers', async (req, res) => {
  try {
    const pool = getPool();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search || '';
    const { col, dir } = parseSortParams(req.query, 'customers');
    let where = '';
    const params = [limit, offset];
    if (search) {
      where = `WHERE email ILIKE $3 OR first_name ILIKE $3 OR last_name ILIKE $3 OR phone ILIKE $3 OR city ILIKE $3`;
      params.push(`%${search}%`);
    }
    const { rows } = await pool.query(
      `SELECT id, email, first_name, last_name, phone, orders_count, total_spent, state,
         city, province, country, zip,
         created_at, updated_at
       FROM shopify_customers ${where} ORDER BY ${col} ${dir} NULLS LAST LIMIT $1 OFFSET $2`,
      params
    );
    res.json(rows);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/collections', async (req, res) => {
  try {
    const pool = getPool();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search || '';
    const { col, dir } = parseSortParams(req.query, 'collections');
    let where = '';
    const params = [limit, offset];
    if (search) {
      where = `WHERE title ILIKE $3 OR handle ILIKE $3 OR collection_type ILIKE $3`;
      params.push(`%${search}%`);
    }
    const { rows } = await pool.query(
      `SELECT id, title, handle, collection_type, sort_order, published_at, created_at, updated_at
       FROM shopify_collections ${where} ORDER BY ${col} ${dir} NULLS LAST LIMIT $1 OFFSET $2`,
      params
    );
    res.json(rows);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/line-items', async (req, res) => {
  try {
    const pool = getPool();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search || '';
    const { col, dir } = parseSortParams(req.query, 'line_items');
    let where = '';
    const params = [limit, offset];
    if (search) {
      where = `WHERE title ILIKE $3 OR variant_title ILIKE $3 OR sku ILIKE $3`;
      params.push(`%${search}%`);
    }
    const { rows } = await pool.query(
      `SELECT id, order_id, product_id, variant_id, title, variant_title, sku, quantity, price, total_discount, fulfillment_status
       FROM shopify_order_line_items ${where} ORDER BY ${col} ${dir} NULLS LAST LIMIT $1 OFFSET $2`,
      params
    );
    res.json(rows);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/variants', async (req, res) => {
  try {
    const pool = getPool();
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search || '';
    const { col, dir } = parseSortParams(req.query, 'variants');
    let where = '';
    const params = [limit, offset];
    if (search) {
      where = `WHERE title ILIKE $3 OR sku ILIKE $3 OR barcode ILIKE $3`;
      params.push(`%${search}%`);
    }
    const { rows } = await pool.query(
      `SELECT id, product_id, title, sku, barcode, price, compare_at_price, inventory_quantity, weight, weight_unit
       FROM shopify_product_variants ${where} ORDER BY ${col} ${dir} NULLS LAST LIMIT $1 OFFSET $2`,
      params
    );
    res.json(rows);
  } catch (e) {
    if (isDbNotReadyError(e)) return res.json([]);
    res.status(500).json({ error: e.message });
  }
});

export default router;
