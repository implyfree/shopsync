import { useState, useEffect, useRef, useCallback } from 'react';

function SyncRuns() {
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState(null);
  const [stopping, setStopping] = useState(false);
  const [selectedRun, setSelectedRun] = useState(null);
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  const load = useCallback(() => {
    fetch('/api/sync/runs?limit=100')
      .then((r) => r.json().catch(() => []))
      .then((d) => setRuns(Array.isArray(d) ? d : []))
      .catch((e) => setError(e?.message || 'Failed to load'));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!selectedRun) { setLogs([]); return; }
    let cancelled = false;
    const fetchLogs = async () => {
      try {
        const res = await fetch(`/api/sync/logs/${selectedRun}`);
        if (!cancelled && res.ok) {
          const d = await res.json();
          setLogs(Array.isArray(d) ? d : []);
        }
      } catch { /* ignore */ }
    };
    fetchLogs();
    const t = setInterval(fetchLogs, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [selectedRun]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const hasRunning = runs.some((r) => r.status === 'running');
  const stopSync = async () => {
    setStopping(true);
    try {
      await fetch('/api/sync/stop', { method: 'POST' });
      load();
    } catch (e) {
      setError(e?.message || 'Failed to stop');
    } finally {
      setStopping(false);
    }
  };

  const formatDate = (s) => (s ? new Date(s).toLocaleString() : '\u2014');
  const formatDuration = (start, end) => {
    if (!start || !end) return '\u2014';
    const ms = new Date(end) - new Date(start);
    if (ms < 1000) return `${ms}ms`;
    const secs = Math.floor(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    return `${mins}m ${secs % 60}s`;
  };

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Sync History</h1>
        <p className="page-subtitle">
          View all sync runs, their status, and detailed execution logs.
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

      {hasRunning && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="btn-group">
            <span className="badge badge-muted animate-pulse">
              <span className="badge-dot" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }}></span>
              Sync in progress
            </span>
            <button className="btn btn-danger btn-sm" onClick={stopSync} disabled={stopping}>
              {stopping ? 'Stopping\u2026' : 'Stop Sync'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
        {/* Runs table */}
        <div className="card" style={{ flex: '1 1 55%', minWidth: 0 }}>
          <div className="card-header">
            <h2 className="card-title">Runs</h2>
            <span className="badge badge-muted">{runs.length} total</span>
          </div>
          <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Records</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const total = (r.entities?.orders || 0) + (r.entities?.products || 0) + (r.entities?.customers || 0) + (r.entities?.collections || 0);
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRun(r.id)}
                      style={{ cursor: 'pointer', background: selectedRun === r.id ? 'var(--accent-glow)' : undefined }}
                    >
                      <td className="mono" style={{ fontSize: '0.78rem' }}>#{r.id}</td>
                      <td style={{ fontSize: '0.82rem' }}>{formatDate(r.started_at)}</td>
                      <td style={{ fontSize: '0.82rem' }}>{formatDuration(r.started_at, r.finished_at)}</td>
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
                      <td>{total > 0 ? total.toLocaleString() : '\u2014'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {runs.length === 0 && !error && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <p className="empty-state-text">No sync runs yet.</p>
            </div>
          )}
        </div>

        {/* Logs panel */}
        <div className="card" style={{ flex: '1 1 45%', minWidth: 0 }}>
          <div className="card-header">
            <h2 className="card-title">
              {selectedRun ? `Logs \u2014 Run #${selectedRun}` : 'Sync Logs'}
            </h2>
            {selectedRun && (
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedRun(null)}>
                Clear
              </button>
            )}
          </div>
          {!selectedRun ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                </svg>
              </div>
              <p className="empty-state-text">Select a sync run to view its logs</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <span className="spinner" style={{ width: 24, height: 24 }}></span>
              </div>
              <p className="empty-state-text">Waiting for logs&hellip;</p>
            </div>
          ) : (
            <div className="log-viewer">
              {logs.map((l) => (
                <div key={l.id} className={`log-line log-${l.level}`}>
                  <span className="log-time">{new Date(l.created_at).toLocaleTimeString()}</span>
                  {l.message}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}

          {selectedRun && (() => {
            const run = runs.find((r) => r.id === selectedRun);
            if (!run) return null;
            return (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <div style={{ fontSize: '0.82rem', color: 'var(--textMuted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>Orders: <strong style={{ color: 'var(--text)' }}>{run.entities?.orders ?? 0}</strong></div>
                  <div>Line Items: <strong style={{ color: 'var(--text)' }}>{run.entities?.order_line_items ?? 0}</strong></div>
                  <div>Products: <strong style={{ color: 'var(--text)' }}>{run.entities?.products ?? 0}</strong></div>
                  <div>Variants: <strong style={{ color: 'var(--text)' }}>{run.entities?.variants ?? 0}</strong></div>
                  <div>Customers: <strong style={{ color: 'var(--text)' }}>{run.entities?.customers ?? 0}</strong></div>
                  <div>Collections: <strong style={{ color: 'var(--text)' }}>{run.entities?.collections ?? 0}</strong></div>
                </div>
                {run.error_message && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--danger)', wordBreak: 'break-word' }}>
                    {run.error_message}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </>
  );
}

export default SyncRuns;
