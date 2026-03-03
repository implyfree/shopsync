import { useState, useEffect, useCallback } from 'react';

function Dashboard() {
  const [counts, setCounts] = useState({ orders: 0, order_line_items: 0, products: 0, variants: 0, customers: 0, collections: 0 });
  const [runs, setRuns] = useState([]);
  const [cursors, setCursors] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [cronConfig, setCronConfig] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [countsRes, runsRes, cronRes, cursorsRes] = await Promise.all([
        fetch('/api/sync/counts'),
        fetch('/api/sync/runs?limit=5'),
        fetch('/api/cron'),
        fetch('/api/sync/cursors'),
      ]);
      if (countsRes.ok) {
        const d = await countsRes.json().catch(() => ({}));
        setCounts({
          orders: Number(d?.orders) || 0,
          order_line_items: Number(d?.order_line_items) || 0,
          products: Number(d?.products) || 0,
          variants: Number(d?.variants) || 0,
          customers: Number(d?.customers) || 0,
          collections: Number(d?.collections) || 0,
        });
      }
      if (runsRes.ok) {
        const d = await runsRes.json().catch(() => []);
        setRuns(Array.isArray(d) ? d : []);
      }
      if (cronRes.ok) {
        const d = await cronRes.json().catch(() => null);
        setCronConfig(d);
      }
      if (cursorsRes.ok) {
        const d = await cursorsRes.json().catch(() => []);
        setCursors(Array.isArray(d) ? d : []);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load');
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  const runSync = async (forceFullSync = false) => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/sync/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceFullSync }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || res.statusText);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  const hasRunning = runs.some((r) => r.status === 'running');
  const stopSync = async () => {
    try {
      await fetch('/api/sync/stop', { method: 'POST' });
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to stop');
    }
  };

  const formatDate = (s) => {
    if (!s) return '\u2014';
    return new Date(s).toLocaleString();
  };

  const lastRun = runs[0];

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          Real-time overview of your Shopify data pipeline. Read-only sync to PostgreSQL.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <svg className="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Action bar */}
      <div className="card card-glow" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header" style={{ marginBottom: 0 }}>
          <div>
            <div style={{ fontSize: '0.84rem', color: 'var(--textMuted)', marginBottom: '0.25rem' }}>
              {lastRun ? `Last sync: ${formatDate(lastRun.finished_at || lastRun.started_at)}` : 'No syncs yet'}
              {lastRun?.sync_type && <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>{lastRun.sync_type}</span>}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--textDim)' }}>
              {cronConfig?.enabled
                ? `Auto-sync active \u00b7 ${cronConfig.schedule}`
                : 'Auto-sync disabled'}
            </div>
          </div>
          <div className="btn-group">
            {hasRunning && (
              <button className="btn btn-danger" onClick={stopSync}>Stop</button>
            )}
            <button className="btn btn-secondary" onClick={() => runSync(true)} disabled={syncing}>
              Full Sync
            </button>
            <button className="btn btn-primary" onClick={() => runSync(false)} disabled={syncing}>
              {syncing ? <><span className="spinner"></span> Syncing&hellip;</> : 'Incremental Sync'}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { value: counts.orders, label: 'Orders' },
          { value: counts.order_line_items, label: 'Line Items' },
          { value: counts.products, label: 'Products' },
          { value: counts.variants, label: 'Variants' },
          { value: counts.customers, label: 'Customers' },
          { value: counts.collections, label: 'Collections' },
        ].map((s, i) => (
          <div key={s.label} className="stat-card animate-in" style={{ animationDelay: `${i * 0.04}s` }}>
            <div className="stat-value">{s.value.toLocaleString()}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Sync cursors */}
      {cursors.length > 0 && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <h2 className="card-title">Incremental Sync Cursors</h2>
            <span className="badge badge-info">
              <span className="badge-dot"></span>
              Tracking {cursors.length} entities
            </span>
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
            {cursors.map((c) => (
              <div key={c.entity} style={{ fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--textMuted)', textTransform: 'capitalize' }}>{c.entity}: </span>
                <span className="mono" style={{ color: 'var(--accent)' }}>{formatDate(c.last_synced_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent syncs */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Syncs</h2>
          {runs.length > 0 && (
            <a href="/sync" style={{ fontSize: '0.82rem' }}>View all &rarr;</a>
          )}
        </div>
        {runs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
              </svg>
            </div>
            <p className="empty-state-text">No syncs yet. Run an incremental or full sync to get started.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Finished</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Orders</th>
                  <th>Products</th>
                  <th>Customers</th>
                  <th>Collections</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.started_at)}</td>
                    <td>{formatDate(r.finished_at)}</td>
                    <td>
                      <span className={`badge ${r.sync_type === 'incremental' ? 'badge-info' : 'badge-muted'}`}>
                        {r.sync_type || 'full'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge badge-${r.status === 'completed' ? 'success' : r.status === 'completed_with_errors' ? 'warning' : r.status === 'failed' ? 'danger' : 'muted'}`}>
                        <span className="badge-dot"></span>
                        {r.status}
                      </span>
                    </td>
                    <td>{r.entities?.orders ?? '\u2014'}</td>
                    <td>{r.entities?.products ?? '\u2014'}</td>
                    <td>{r.entities?.customers ?? '\u2014'}</td>
                    <td>{r.entities?.collections ?? '\u2014'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

export default Dashboard;
