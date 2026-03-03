import { useState, useEffect } from 'react';

function Settings() {
  const [settings, setSettings] = useState({
    databaseUrl: '',
    shopify: { store: '', accessToken: '' },
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState('info');
  const [dbTest, setDbTest] = useState(null);
  const [shopifyTest, setShopifyTest] = useState(null);
  const [initDbLoading, setInitDbLoading] = useState(false);
  const [resettingCursors, setResettingCursors] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json().catch(() => null))
      .then((s) => {
        if (!s || typeof s !== 'object') return;
        setSettings({
          databaseUrl: s.databaseUrl === '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' ? '' : (s.databaseUrl || ''),
          shopify: {
            store: (s.shopify && s.shopify.store) || '',
            accessToken: (s.shopify && s.shopify.accessToken) === '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' ? '' : ((s.shopify && s.shopify.accessToken) || ''),
          },
        });
      })
      .catch(() => showMessage('Failed to load settings', 'error'));
  }, []);

  const showMessage = (msg, type = 'info') => {
    setMessage(msg);
    setMessageType(type);
    if (type === 'success') {
      setTimeout(() => setMessage(null), 5000);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setDbTest(null);
    setShopifyTest(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          databaseUrl: settings.databaseUrl || undefined,
          shopify: {
            store: settings.shopify?.store || undefined,
            accessToken: settings.shopify?.accessToken || undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showMessage('Settings saved successfully', 'success');
        setSettings({
          databaseUrl: data.databaseUrl === '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' ? '' : (data.databaseUrl ?? ''),
          shopify: {
            store: data.shopify?.store ?? settings.shopify?.store ?? '',
            accessToken: data.shopify?.accessToken === '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' ? '' : (data.shopify?.accessToken ?? ''),
          },
        });
      } else {
        showMessage(data.error || 'Save failed', 'error');
      }
    } catch (e) {
      showMessage(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const initDb = async () => {
    const url = settings.databaseUrl || undefined;
    if (!url) {
      showMessage('Enter a connection string first', 'error');
      return;
    }
    setInitDbLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/init-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl: url, connectionString: url }),
      });
      const data = await res.json();
      if (data.ok) {
        showMessage('Database initialized successfully. All tables created.', 'success');
      } else {
        showMessage(data.error || 'Init failed', 'error');
      }
    } catch (e) {
      showMessage(e.message, 'error');
    } finally {
      setInitDbLoading(false);
    }
  };

  const testDb = async () => {
    const url = settings.databaseUrl || undefined;
    if (!url) {
      setDbTest({ ok: false, error: 'Enter a connection string first' });
      return;
    }
    setDbTest(null);
    try {
      const res = await fetch('/api/settings/test-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseUrl: url, connectionString: url }),
      });
      const data = await res.json();
      setDbTest(data);
    } catch (e) {
      setDbTest({ ok: false, error: e.message });
    }
  };

  const testShopify = async () => {
    setShopifyTest(null);
    try {
      const res = await fetch('/api/settings/test-shopify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings.shopify),
      });
      const data = await res.json();
      setShopifyTest(data);
    } catch (e) {
      setShopifyTest({ ok: false, error: e.message });
    }
  };

  const resetCursors = async () => {
    if (!confirm('This will reset all sync cursors. The next sync will be a full sync. Continue?')) return;
    setResettingCursors(true);
    try {
      await fetch('/api/sync/cursors/reset', { method: 'POST' });
      showMessage('Sync cursors reset. Next sync will be a full sync.', 'success');
    } catch (e) {
      showMessage(e.message, 'error');
    } finally {
      setResettingCursors(false);
    }
  };

  const SectionIcon = ({ children }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: '0.5rem', color: 'var(--accent)' }}>{children}</span>
  );

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          Configure your PostgreSQL database and Shopify API connection.
        </p>
      </div>

      {message && (
        <div className={`toast ${messageType === 'success' ? 'toast-success' : messageType === 'error' ? 'toast-error' : ''}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* PostgreSQL Section */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center' }}>
              <SectionIcon>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>
                </svg>
              </SectionIcon>
              PostgreSQL Database
            </h2>
          </div>
          <div className="input-group">
            <label>Connection string</label>
            <input
              type="password"
              placeholder="postgresql://user:password@host:5432/dbname"
              value={settings.databaseUrl}
              onChange={(e) => setSettings((s) => ({ ...s, databaseUrl: e.target.value }))}
            />
          </div>
          <div className="btn-group">
            <button type="button" className="btn btn-secondary" onClick={testDb}>
              Test Connection
            </button>
            <button type="button" className="btn btn-primary" onClick={initDb} disabled={initDbLoading}>
              {initDbLoading ? <><span className="spinner"></span> Initializing&hellip;</> : 'Initialize Database'}
            </button>
            {dbTest !== null && (
              <span style={{ color: dbTest.ok ? 'var(--success)' : 'var(--danger)', fontSize: '0.84rem' }}>
                {dbTest.ok ? 'Connected successfully' : dbTest.error}
              </span>
            )}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.76rem', color: 'var(--textDim)' }}>
            Creates all required tables: orders, products, customers, line items, variants, collections, inventory, and sync history.
          </div>
        </div>

        {/* Shopify Section */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center' }}>
              <SectionIcon>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </SectionIcon>
              Shopify Store
            </h2>
          </div>
          <div className="input-group">
            <label>Store domain</label>
            <input
              type="text"
              placeholder="my-store.myshopify.com"
              value={settings.shopify?.store || ''}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  shopify: { ...s.shopify, store: e.target.value },
                }))
              }
            />
          </div>
          <div className="input-group">
            <label>Admin API access token</label>
            <input
              type="password"
              placeholder="shpat_xxxx (leave blank to keep current)"
              value={settings.shopify?.accessToken || ''}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  shopify: { ...s.shopify, accessToken: e.target.value },
                }))
              }
            />
          </div>
          <div className="btn-group">
            <button type="button" className="btn btn-secondary" onClick={testShopify}>
              Test Shopify
            </button>
            {shopifyTest !== null && (
              <span style={{ color: shopifyTest.ok ? 'var(--success)' : 'var(--danger)', fontSize: '0.84rem' }}>
                {shopifyTest.ok
                  ? `Connected to ${shopifyTest.shop?.name || 'store'}`
                  : (shopifyTest.error?.message || shopifyTest.error || 'Connection failed')}
              </span>
            )}
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.76rem', color: 'var(--textDim)' }}>
            Required scopes: <code className="mono">read_orders, read_products, read_customers</code>. For orders older than 60 days: <code className="mono">read_all_orders</code>.
          </div>
        </div>

        {/* Save button */}
        <div style={{ marginBottom: '1.25rem' }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><span className="spinner"></span> Saving&hellip;</> : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* Advanced */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title" style={{ display: 'flex', alignItems: 'center' }}>
            <SectionIcon>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </SectionIcon>
            Advanced
          </h2>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.5rem' }}>Reset Sync Cursors</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--textMuted)', margin: '0 0 0.75rem' }}>
            Clears incremental sync timestamps. The next sync will fetch all data from Shopify (full sync).
          </p>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={resetCursors}
            disabled={resettingCursors}
          >
            {resettingCursors ? 'Resetting\u2026' : 'Reset Cursors'}
          </button>
        </div>

        <hr className="divider" />

        <div>
          <h3 style={{ fontSize: '0.86rem', fontWeight: 600, marginBottom: '0.5rem' }}>Database Tables</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.35rem', fontSize: '0.8rem' }}>
            {[
              'shopify_orders',
              'shopify_order_line_items',
              'shopify_products',
              'shopify_product_variants',
              'shopify_product_images',
              'shopify_customers',
              'shopify_collections',
              'shopify_inventory_levels',
              'sync_runs',
              'sync_logs',
              'sync_cursors',
              'cron_jobs',
              'app_settings',
            ].map((t) => (
              <div key={t} className="mono" style={{ color: 'var(--accent)', padding: '0.2rem 0' }}>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default Settings;
