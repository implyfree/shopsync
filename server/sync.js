import { getPool } from './db.js';
import {
  fetchOrders,
  fetchProducts,
  fetchCustomers,
  fetchCustomCollections,
  fetchSmartCollections,
  fetchInventoryLevels,
} from './shopify.js';
import { getSettings } from './settings.js';

function getSettingsPool() {
  return getPool();
}

function getStoredSettings() {
  const s = getSettings();
  return { store: s.shopify.store, accessToken: s.shopify.accessToken };
}

// ---------- sync log helper ----------
async function logSync(pool, runId, message, level = 'info') {
  try {
    await pool.query(
      'INSERT INTO sync_logs (run_id, level, message) VALUES ($1, $2, $3)',
      [runId, level, message]
    );
  } catch {
    // ignore logging errors
  }
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`[sync:${runId}] ${prefix} ${message}`);
}

async function updateProgress(pool, runId, entities) {
  try {
    await pool.query(
      'UPDATE sync_runs SET entities = $2, progress = $2 WHERE id = $1',
      [runId, JSON.stringify(entities)]
    );
  } catch {
    // ignore
  }
}

// ---------- cursor helpers ----------
async function getCursor(pool, entity) {
  try {
    const { rows } = await pool.query(
      'SELECT last_synced_at FROM sync_cursors WHERE entity = $1',
      [entity]
    );
    if (rows.length > 0) {
      return rows[0].last_synced_at?.toISOString();
    }
  } catch {
    // table might not exist yet
  }
  return null;
}

async function setCursor(pool, entity, timestamp) {
  await pool.query(
    `INSERT INTO sync_cursors (entity, last_synced_at, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (entity) DO UPDATE SET last_synced_at = $2, updated_at = NOW()`,
    [entity, timestamp]
  );
}

// -------- BATCH UPSERT HELPER --------
// Builds a single multi-row INSERT ... ON CONFLICT query for a batch of rows
async function batchUpsert(pool, table, columns, conflictKeys, updateCols, rowsBatch) {
  if (rowsBatch.length === 0) return;
  // Deduplicate: if same conflict key appears twice in a batch, keep last one
  const conflictIndices = conflictKeys.map(k => columns.indexOf(k));
  const seen = new Map();
  for (let i = 0; i < rowsBatch.length; i++) {
    const key = conflictIndices.map(ci => String(rowsBatch[i][ci])).join('|');
    seen.set(key, rowsBatch[i]);
  }
  const deduped = [...seen.values()];

  const colCount = columns.length;
  const valuePlaceholders = [];
  const allValues = [];
  for (let i = 0; i < deduped.length; i++) {
    const row = deduped[i];
    const placeholders = columns.map((_, j) => `$${i * colCount + j + 1}`);
    valuePlaceholders.push(`(${placeholders.join(',')})`);
    allValues.push(...row);
  }
  const updateSet = updateCols.map((c) => `${c}=EXCLUDED.${c}`).join(',');
  const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES ${valuePlaceholders.join(',')} ON CONFLICT (${conflictKeys.join(',')}) DO UPDATE SET ${updateSet}`;
  await pool.query(sql, allValues);
}

const BATCH_SIZE = 50;

// -------- batch upsert functions --------

async function batchUpsertOrders(pool, orders, runId, logFn) {
  // Process in batches
  const orderCols = ['id', 'order_number', 'name', 'email', 'total_price', 'subtotal_price', 'total_tax',
    'total_discounts', 'currency', 'financial_status', 'fulfillment_status', 'cancelled_at', 'cancel_reason',
    'tags', 'note', 'created_at', 'updated_at', 'closed_at', 'processed_at', 'raw'];
  const orderUpdate = orderCols.filter(c => c !== 'id');

  const liCols = ['id', 'order_id', 'product_id', 'variant_id', 'title', 'variant_title',
    'sku', 'quantity', 'price', 'total_discount', 'fulfillment_status', 'requires_shipping', 'taxable', 'raw'];
  const liUpdate = liCols.filter(c => c !== 'id');

  let orderCount = 0;
  let liCount = 0;
  const totalOrders = orders.length;

  for (let i = 0; i < orders.length; i += BATCH_SIZE) {
    const batch = orders.slice(i, i + BATCH_SIZE);

    // Batch orders
    const orderRows = batch.map(o => [
      o.id, o.order_number, o.name || null, o.email || null,
      o.total_price || null, o.subtotal_price || null, o.total_tax || null,
      o.total_discounts || null, o.currency || null,
      o.financial_status || null, o.fulfillment_status || null,
      o.cancelled_at || null, o.cancel_reason || null,
      o.tags || null, o.note || null,
      o.created_at || null, o.updated_at || null,
      o.closed_at || null, o.processed_at || null,
      JSON.stringify(o),
    ]);
    await batchUpsert(pool, 'shopify_orders', orderCols, ['id'], orderUpdate, orderRows);
    orderCount += batch.length;

    // Batch line items for this batch of orders
    const allLineItems = [];
    for (const o of batch) {
      for (const li of (o.line_items || [])) {
        allLineItems.push([
          li.id, o.id, li.product_id || null, li.variant_id || null,
          li.title || null, li.variant_title || null, li.sku || null,
          li.quantity ?? null, li.price || null, li.total_discount || null,
          li.fulfillment_status || null,
          li.requires_shipping ?? null, li.taxable ?? null,
          JSON.stringify(li),
        ]);
        liCount++;
      }
    }
    // Sub-batch line items
    for (let j = 0; j < allLineItems.length; j += BATCH_SIZE) {
      await batchUpsert(pool, 'shopify_order_line_items', liCols, ['id'], liUpdate, allLineItems.slice(j, j + BATCH_SIZE));
    }

    // Log progress every 500 orders
    if (orderCount % 500 < BATCH_SIZE) {
      await logFn(`Upserted ${orderCount}/${totalOrders} orders, ${liCount} line items...`);
    }
  }
  return { orders: orderCount, lineItems: liCount };
}

async function batchUpsertProducts(pool, products, runId, logFn) {
  const prodCols = ['id', 'title', 'handle', 'vendor', 'product_type', 'status', 'tags', 'body_html',
    'template_suffix', 'published_scope', 'published_at', 'created_at', 'updated_at', 'raw'];
  const prodUpdate = prodCols.filter(c => c !== 'id');

  const varCols = ['id', 'product_id', 'title', 'sku', 'barcode', 'price', 'compare_at_price',
    'position', 'inventory_quantity', 'inventory_item_id', 'weight', 'weight_unit', 'requires_shipping', 'taxable',
    'created_at', 'updated_at', 'raw'];
  const varUpdate = varCols.filter(c => c !== 'id');

  const imgCols = ['id', 'product_id', 'position', 'src', 'alt', 'width', 'height', 'created_at', 'updated_at'];
  const imgUpdate = imgCols.filter(c => c !== 'id');

  let prodCount = 0, varCount = 0, imgCount = 0;
  const total = products.length;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    const prodRows = batch.map(p => [
      p.id, p.title || null, p.handle || null, p.vendor || null,
      p.product_type || null, p.status || null, p.tags || null,
      p.body_html || null, p.template_suffix || null,
      p.published_scope || null, p.published_at || null,
      p.created_at || null, p.updated_at || null,
      JSON.stringify(p),
    ]);
    await batchUpsert(pool, 'shopify_products', prodCols, ['id'], prodUpdate, prodRows);
    prodCount += batch.length;

    // Variants
    const allVars = [];
    for (const p of batch) {
      for (const v of (p.variants || [])) {
        allVars.push([
          v.id, p.id, v.title || null, v.sku || null, v.barcode || null,
          v.price || null, v.compare_at_price || null, v.position ?? null,
          v.inventory_quantity ?? null, v.inventory_item_id || null,
          v.weight ?? null, v.weight_unit || null,
          v.requires_shipping ?? null, v.taxable ?? null,
          v.created_at || null, v.updated_at || null,
          JSON.stringify(v),
        ]);
        varCount++;
      }
    }
    for (let j = 0; j < allVars.length; j += BATCH_SIZE) {
      await batchUpsert(pool, 'shopify_product_variants', varCols, ['id'], varUpdate, allVars.slice(j, j + BATCH_SIZE));
    }

    // Images
    const allImgs = [];
    for (const p of batch) {
      for (const img of (p.images || [])) {
        allImgs.push([
          img.id, p.id, img.position ?? null, img.src || null,
          img.alt || null, img.width || null, img.height || null,
          img.created_at || null, img.updated_at || null,
        ]);
        imgCount++;
      }
    }
    for (let j = 0; j < allImgs.length; j += BATCH_SIZE) {
      await batchUpsert(pool, 'shopify_product_images', imgCols, ['id'], imgUpdate, allImgs.slice(j, j + BATCH_SIZE));
    }

    if (prodCount % 200 < BATCH_SIZE) {
      await logFn(`Upserted ${prodCount}/${total} products, ${varCount} variants, ${imgCount} images...`);
    }
  }
  return { products: prodCount, variants: varCount, images: imgCount };
}

async function batchUpsertCustomers(pool, customers, runId, logFn) {
  const cols = ['id', 'email', 'first_name', 'last_name', 'phone', 'orders_count', 'total_spent',
    'state', 'tags', 'note', 'verified_email', 'tax_exempt', 'currency',
    'address1', 'address2', 'city', 'province', 'province_code', 'country', 'country_code', 'zip',
    'created_at', 'updated_at', 'raw'];
  const updateCols = cols.filter(c => c !== 'id');

  let count = 0;
  const total = customers.length;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);
    const rows = batch.map(c => {
      const addr = c.default_address || {};
      const phone = c.phone || addr.phone || null;
      return [
        c.id, c.email || null, c.first_name || null, c.last_name || null,
        phone, c.orders_count ?? null, c.total_spent || null,
        c.state || null, c.tags || null, c.note || null,
        c.verified_email ?? null, c.tax_exempt ?? null,
        c.currency || null,
        addr.address1 || null, addr.address2 || null, addr.city || null,
        addr.province || null, addr.province_code || null,
        addr.country || null, addr.country_code || null, addr.zip || null,
        c.created_at || null, c.updated_at || null,
        JSON.stringify(c),
      ];
    });
    await batchUpsert(pool, 'shopify_customers', cols, ['id'], updateCols, rows);
    count += batch.length;

    if (count % 500 < BATCH_SIZE) {
      await logFn(`Upserted ${count}/${total} customers...`);
    }
  }
  return count;
}

async function batchUpsertCollections(pool, collections, type, logFn) {
  const cols = ['id', 'title', 'handle', 'collection_type', 'body_html', 'sort_order',
    'published_scope', 'published_at', 'created_at', 'updated_at', 'raw'];
  const updateCols = cols.filter(c => c !== 'id');

  const rows = collections.map(col => [
    col.id, col.title || null, col.handle || null, type,
    col.body_html || null, col.sort_order || null,
    col.published_scope || null, col.published_at || null,
    col.created_at || null, col.updated_at || null,
    JSON.stringify(col),
  ]);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await batchUpsert(pool, 'shopify_collections', cols, ['id'], updateCols, rows.slice(i, i + BATCH_SIZE));
  }
  return collections.length;
}

async function batchUpsertInventory(pool, levels) {
  const cols = ['inventory_item_id', 'location_id', 'available', 'updated_at'];
  const updateCols = ['available', 'updated_at'];

  const rows = levels.map(il => [
    il.inventory_item_id, il.location_id, il.available ?? null,
    il.updated_at || new Date().toISOString(),
  ]);
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await batchUpsert(pool, 'shopify_inventory_levels', cols, ['inventory_item_id', 'location_id'], updateCols, rows.slice(i, i + BATCH_SIZE));
  }
  return levels.length;
}

// ==================== MAIN SYNC ====================
export async function runSync({ forceFullSync = false } = {}) {
  const { store, accessToken } = getStoredSettings();
  if (!store || !accessToken) {
    throw new Error('Shopify store and access token must be set in Settings');
  }

  const pool = getSettingsPool();

  // Determine sync type
  const ordersCursor = forceFullSync ? null : await getCursor(pool, 'orders');
  const productsCursor = forceFullSync ? null : await getCursor(pool, 'products');
  const customersCursor = forceFullSync ? null : await getCursor(pool, 'customers');
  const collectionsCursor = forceFullSync ? null : await getCursor(pool, 'collections');

  const isIncremental = !forceFullSync && !!(ordersCursor || productsCursor || customersCursor);
  const syncType = isIncremental ? 'incremental' : 'full';

  const runResult = await pool.query(
    `INSERT INTO sync_runs (started_at, status, sync_type, entities, progress) VALUES (NOW(), 'running', $1, '{}', '{}') RETURNING id`,
    [syncType]
  );
  const runId = runResult.rows[0].id;
  const syncStartTime = new Date().toISOString();

  const entities = {
    orders: 0, order_line_items: 0,
    products: 0, variants: 0, images: 0,
    customers: 0,
    collections: 0,
    inventory_levels: 0,
  };

  const log = (msg, level) => logSync(pool, runId, msg, level);

  await log(`Starting ${syncType} sync...`);
  if (isIncremental) {
    await log(`Incremental since: orders=${ordersCursor || 'never'}, products=${productsCursor || 'never'}, customers=${customersCursor || 'never'}`);
  }

  try {
    // ---- ORDERS ----
    await log('Fetching orders from Shopify...');
    const orders = await fetchOrders(store, accessToken, {
      updatedAtMin: ordersCursor,
      onPage: (items, page) => { log(`Orders page ${page}: ${items.length} items`); },
    });
    await log(`Received ${orders.length} orders. Batch upserting...`);
    const orderResult = await batchUpsertOrders(pool, orders, runId, log);
    entities.orders = orderResult.orders;
    entities.order_line_items = orderResult.lineItems;
    await updateProgress(pool, runId, entities);
    await setCursor(pool, 'orders', syncStartTime);
    await log(`✅ Orders done: ${entities.orders} orders, ${entities.order_line_items} line items`);

    // ---- PRODUCTS ----
    let productError = null;
    try {
      await log('Fetching products from Shopify...');
      const products = await fetchProducts(store, accessToken, {
        updatedAtMin: productsCursor,
        onPage: (items, page) => { log(`Products page ${page}: ${items.length} items`); },
      });
      await log(`Received ${products.length} products. Batch upserting...`);
      const prodResult = await batchUpsertProducts(pool, products, runId, log);
      entities.products = prodResult.products;
      entities.variants = prodResult.variants;
      entities.images = prodResult.images;
      await updateProgress(pool, runId, entities);
      await setCursor(pool, 'products', syncStartTime);
      await log(`✅ Products done: ${entities.products} products, ${entities.variants} variants, ${entities.images} images`);
    } catch (e) {
      productError = e.response?.data?.errors || e.response?.data?.error || e.message;
      await log(`Products error: ${productError}`, 'error');
    }

    // ---- CUSTOMERS ----
    let customerError = null;
    try {
      await log('Fetching customers from Shopify...');
      const customers = await fetchCustomers(store, accessToken, {
        updatedAtMin: customersCursor,
        onPage: (items, page) => { log(`Customers page ${page}: ${items.length} items`); },
      });
      await log(`Received ${customers.length} customers. Batch upserting...`);
      entities.customers = await batchUpsertCustomers(pool, customers, runId, log);
      await updateProgress(pool, runId, entities);
      await setCursor(pool, 'customers', syncStartTime);
      await log(`✅ Customers done: ${entities.customers}`);
    } catch (e) {
      customerError = e.response?.data?.errors || e.response?.data?.error || e.message;
      await log(`Customers error: ${customerError}`, 'error');
    }

    // ---- COLLECTIONS ----
    let collectionError = null;
    try {
      await log('Fetching collections from Shopify...');
      const customCols = await fetchCustomCollections(store, accessToken, {
        updatedAtMin: collectionsCursor,
      });
      const customCount = await batchUpsertCollections(pool, customCols, 'custom', log);
      const smartCols = await fetchSmartCollections(store, accessToken, {
        updatedAtMin: collectionsCursor,
      });
      const smartCount = await batchUpsertCollections(pool, smartCols, 'smart', log);
      entities.collections = customCount + smartCount;
      await updateProgress(pool, runId, entities);
      await setCursor(pool, 'collections', syncStartTime);
      await log(`✅ Collections done: ${entities.collections}`);
    } catch (e) {
      collectionError = e.response?.data?.errors || e.response?.data?.error || e.message;
      await log(`Collections error: ${collectionError}`, 'warn');
    }

    // ---- INVENTORY LEVELS ----
    let inventoryError = null;
    try {
      await log('Fetching inventory levels...');
      const levels = await fetchInventoryLevels(store, accessToken);
      entities.inventory_levels = await batchUpsertInventory(pool, levels);
      await updateProgress(pool, runId, entities);
      await log(`✅ Inventory done: ${entities.inventory_levels} levels`);
    } catch (e) {
      inventoryError = e.response?.data?.errors || e.response?.data?.error || e.message;
      await log(`Inventory error: ${inventoryError}`, 'warn');
    }

    // ---- FINISH ----
    const partialErrors = [
      productError && `Products: ${productError}`,
      customerError && `Customers: ${customerError}`,
      collectionError && `Collections: ${collectionError}`,
      inventoryError && `Inventory: ${inventoryError}`,
    ].filter(Boolean);
    const errorNote = partialErrors.length ? partialErrors.join('; ') : null;
    const finalStatus = partialErrors.length ? 'completed_with_errors' : 'completed';

    await pool.query(
      `UPDATE sync_runs SET finished_at = NOW(), status = $2, entities = $3, error_message = $4 WHERE id = $1`,
      [runId, finalStatus, JSON.stringify(entities), errorNote || null]
    );
    await log(`Sync finished: ${finalStatus}`);
    return { runId, entities, status: finalStatus, syncType, errorNote };

  } catch (err) {
    const errMsg =
      (err.response?.data?.errors &&
        (Array.isArray(err.response.data.errors)
          ? err.response.data.errors.join(' ')
          : String(err.response.data.errors))) ||
      err.response?.data?.error ||
      err.message;
    await pool.query(
      `UPDATE sync_runs SET finished_at = NOW(), status = 'failed', entities = $2, error_message = $3 WHERE id = $1`,
      [runId, JSON.stringify(entities), String(errMsg)]
    );
    await log(`Sync FAILED: ${errMsg}`, 'error');
    throw err;
  }
}

export async function getSyncRuns(limit = 50) {
  const pool = getSettingsPool();
  const { rows } = await pool.query(
    `SELECT id, started_at, finished_at, status, sync_type, entities, error_message, progress
     FROM sync_runs ORDER BY id DESC LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function getSyncLogs(runId, afterId = 0) {
  const pool = getSettingsPool();
  const { rows } = await pool.query(
    `SELECT id, level, message, created_at FROM sync_logs WHERE run_id = $1 AND id > $2 ORDER BY id ASC LIMIT 200`,
    [runId, afterId]
  );
  return rows;
}

export async function getDataCounts() {
  const pool = getSettingsPool();
  const [orders, lineItems, products, variants, customers, collections] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS c FROM shopify_orders'),
    pool.query('SELECT COUNT(*)::int AS c FROM shopify_order_line_items'),
    pool.query('SELECT COUNT(*)::int AS c FROM shopify_products'),
    pool.query('SELECT COUNT(*)::int AS c FROM shopify_product_variants'),
    pool.query('SELECT COUNT(*)::int AS c FROM shopify_customers'),
    pool.query('SELECT COUNT(*)::int AS c FROM shopify_collections'),
  ]);
  return {
    orders: orders.rows[0]?.c ?? 0,
    order_line_items: lineItems.rows[0]?.c ?? 0,
    products: products.rows[0]?.c ?? 0,
    variants: variants.rows[0]?.c ?? 0,
    customers: customers.rows[0]?.c ?? 0,
    collections: collections.rows[0]?.c ?? 0,
  };
}

export async function getSyncCursors() {
  const pool = getSettingsPool();
  try {
    const { rows } = await pool.query(
      'SELECT entity, last_synced_at FROM sync_cursors ORDER BY entity'
    );
    return rows;
  } catch {
    return [];
  }
}

export async function resetSyncCursors() {
  const pool = getSettingsPool();
  await pool.query('DELETE FROM sync_cursors');
}
