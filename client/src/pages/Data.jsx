import { useState, useEffect, useCallback } from 'react';

const TABS = [
  { id: 'orders', label: 'Orders', api: '/api/orders', countKey: 'orders' },
  { id: 'line_items', label: 'Line Items', api: '/api/line-items', countKey: 'order_line_items' },
  { id: 'products', label: 'Products', api: '/api/products', countKey: 'products' },
  { id: 'variants', label: 'Variants', api: '/api/variants', countKey: 'variants' },
  { id: 'customers', label: 'Customers', api: '/api/customers', countKey: 'customers' },
  { id: 'collections', label: 'Collections', api: '/api/collections', countKey: 'collections' },
];

function Data() {
  const [tab, setTab] = useState('orders');
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('DESC');
  const limit = 100;

  const current = TABS.find((t) => t.id === tab);

  useEffect(() => {
    fetch('/api/sync/counts')
      .then((r) => r.json().catch(() => ({})))
      .then((d) => setCounts(d || {}));
  }, []);

  const loadData = useCallback(async () => {
    if (!current) return;
    setError(null);
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit, offset, sort_by: sortBy, sort_dir: sortDir });
      if (search) {
        params.set('search', search);
      }
      const res = await fetch(`${current.api}?${params}`);
      const data = await res.json().catch(() => []);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [tab, current, search, offset, sortBy, sortDir]);

  useEffect(() => {
    setOffset(0);
  }, [tab, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setSortBy('created_at');
    setSortDir('DESC');
    setSearch('');
  }, [tab]);

  const handleSort = (key) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'DESC' ? 'ASC' : 'DESC'));
    } else {
      setSortBy(key);
      setSortDir('DESC');
    }
    setOffset(0);
  };

  const formatDate = (s) => (s ? new Date(s).toLocaleString() : '\u2014');
  const formatMoney = (n) => (n != null ? Number(n).toFixed(2) : '\u2014');

  const columnDefs = {
    orders: [
      { key: 'id', label: 'ID', mono: true },
      { key: 'order_number', label: 'Order #' },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'total_price', label: 'Total', format: formatMoney },
      { key: 'currency', label: 'Currency' },
      { key: 'financial_status', label: 'Financial' },
      { key: 'fulfillment_status', label: 'Fulfillment' },
      { key: 'created_at', label: 'Created', format: formatDate },
    ],
    line_items: [
      { key: 'id', label: 'ID', mono: true },
      { key: 'order_id', label: 'Order ID', mono: true },
      { key: 'title', label: 'Product' },
      { key: 'variant_title', label: 'Variant' },
      { key: 'sku', label: 'SKU', mono: true },
      { key: 'quantity', label: 'Qty' },
      { key: 'price', label: 'Price', format: formatMoney },
      { key: 'total_discount', label: 'Discount', format: formatMoney },
      { key: 'fulfillment_status', label: 'Fulfillment' },
    ],
    products: [
      { key: 'id', label: 'ID', mono: true },
      { key: 'title', label: 'Title' },
      { key: 'handle', label: 'Handle', mono: true },
      { key: 'vendor', label: 'Vendor' },
      { key: 'product_type', label: 'Type' },
      { key: 'status', label: 'Status' },
      { key: 'tags', label: 'Tags' },
      { key: 'created_at', label: 'Created', format: formatDate },
    ],
    variants: [
      { key: 'id', label: 'ID', mono: true },
      { key: 'product_id', label: 'Product ID', mono: true },
      { key: 'title', label: 'Title' },
      { key: 'sku', label: 'SKU', mono: true },
      { key: 'barcode', label: 'Barcode' },
      { key: 'price', label: 'Price', format: formatMoney },
      { key: 'compare_at_price', label: 'Compare', format: formatMoney },
      { key: 'inventory_quantity', label: 'Stock' },
      { key: 'weight', label: 'Weight' },
    ],
    customers: [
      { key: 'id', label: 'ID', mono: true },
      { key: 'email', label: 'Email' },
      { key: 'first_name', label: 'First' },
      { key: 'last_name', label: 'Last' },
      { key: 'phone', label: 'Phone' },
      { key: 'orders_count', label: 'Orders' },
      { key: 'total_spent', label: 'Total Spent', format: formatMoney },
      { key: 'city', label: 'City' },
      { key: 'province', label: 'Province' },
      { key: 'country', label: 'Country' },
      { key: 'zip', label: 'Zip' },
      { key: 'state', label: 'State' },
      { key: 'created_at', label: 'Created', format: formatDate },
    ],
    collections: [
      { key: 'id', label: 'ID', mono: true },
      { key: 'title', label: 'Title' },
      { key: 'handle', label: 'Handle', mono: true },
      { key: 'collection_type', label: 'Type' },
      { key: 'sort_order', label: 'Sort' },
      { key: 'published_at', label: 'Published', format: formatDate },
      { key: 'created_at', label: 'Created', format: formatDate },
    ],
  };

  const cols = columnDefs[tab] || [];

  const sortIndicator = (key) => {
    if (sortBy !== key) return <span style={{ opacity: 0.25, marginLeft: 4 }}>\u21C5</span>;
    return <span style={{ marginLeft: 4, color: 'var(--accent)' }}>{sortDir === 'ASC' ? '\u25B2' : '\u25BC'}</span>;
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Browse Data</h1>
        <p className="page-subtitle">
          Preview synced Shopify data stored in PostgreSQL. Connect Power BI or any reporting tool to the same database.
        </p>
      </div>

      {/* Stats row */}
      <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
        {TABS.map((t) => (
          <div
            key={t.id}
            className="stat-card"
            onClick={() => setTab(t.id)}
            style={{ cursor: 'pointer', borderColor: tab === t.id ? 'var(--accent)' : undefined }}
          >
            <div className="stat-value" style={{ fontSize: '1.3rem' }}>
              {(counts[t.countKey] || 0).toLocaleString()}
            </div>
            <div className="stat-label" style={{ fontSize: '0.7rem' }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            <span className="tab-count">{(counts[t.countKey] || 0).toLocaleString()}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="search-input" style={{ marginBottom: '1rem', maxWidth: '400px' }}>
        <span className="search-icon">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </span>
        <input
          type="text"
          placeholder={`Search ${current?.label}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.6rem 0.85rem 0.6rem 2.5rem',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text)',
            fontSize: '0.86rem',
          }}
        />
      </div>

      {error && (
        <div className="alert alert-error">
          <svg className="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Data table */}
      <div className="card">
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <span className="spinner"></span>
            <span style={{ fontSize: '0.82rem', color: 'var(--textMuted)' }}>Loading...</span>
          </div>
        )}
        <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 420px)', overflowY: 'auto' }}>
          <table>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.key}
                    onClick={() => handleSort(c.key)}
                    style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  >
                    {c.label}{sortIndicator(c.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id || i}>
                  {cols.map((c) => (
                    <td key={c.key} className={c.mono ? 'mono' : ''} style={c.mono ? { fontSize: '0.78rem' } : {}}>
                      {c.format ? c.format(r[c.key]) : (r[c.key] ?? '\u2014')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 && !error && !loading && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>
              </svg>
            </div>
            <p className="empty-state-text">No data available. Run a sync first.</p>
          </div>
        )}

        {/* Pagination */}
        {(rows.length > 0 || offset > 0) && (
          <div className="pagination">
            <div className="pagination-info">
              Showing {offset + 1}\u2013{offset + rows.length} of {(counts[current?.countKey] || 0).toLocaleString()} total
            </div>
            <div className="btn-group">
              <button
                className="btn btn-secondary btn-sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                &larr; Previous
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={rows.length < limit}
                onClick={() => setOffset(offset + limit)}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Data;
