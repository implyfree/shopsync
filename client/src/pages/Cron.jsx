import { useState, useEffect, useCallback } from 'react';

const PRESETS = [
  { label: 'Every 15 min', value: '*/15 * * * *' },
  { label: 'Every 30 min', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 3 hours', value: '0 */3 * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: 'Daily midnight', value: '0 0 * * *' },
  { label: 'Daily 6 AM', value: '0 6 * * *' },
];

function Cron() {
  const [config, setConfig] = useState({ schedule: '0 * * * *', enabled: true, last_run_at: null });
  const [schedule, setSchedule] = useState('0 * * * *');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setError(null);
    fetch('/api/cron')
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (!d || typeof d !== 'object') return;
        if (d.error) { setError(d.error); return; }
        setConfig(d);
        setSchedule(d.schedule || '0 * * * *');
        setEnabled(d.enabled !== false);
      })
      .catch((e) => setError(e?.message || 'Failed to load'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/cron', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedule, enabled }),
      });
      const data = await res.json();
      if (res.ok) {
        setConfig(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const activePreset = PRESETS.find(p => p.value === schedule);
  const humanSchedule = activePreset?.label || schedule;

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Sync Schedule</h1>
        <p className="page-subtitle">
          Configure automatic sync intervals using cron expressions. Syncs run in incremental mode by default.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <svg className="alert-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            {error}
            {error.includes('Database not initialized') && (
              <div style={{ marginTop: '0.35rem' }}>
                <a href="/settings">Go to Settings &rarr;</a>
              </div>
            )}
          </div>
        </div>
      )}

      {saved && (
        <div className="toast toast-success">Schedule saved successfully</div>
      )}

      <div className="card">
        {/* Toggle */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="toggle-wrap" onClick={() => setEnabled((e) => !e)}>
            <div className={`toggle ${enabled ? 'active' : ''}`} />
            <span className="toggle-label">
              {enabled ? 'Auto-sync enabled' : 'Auto-sync disabled'}
            </span>
          </div>
        </div>

        <hr className="divider" />

        {/* Schedule input */}
        <div className="input-group">
          <label>Cron expression</label>
          <input
            className="mono"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="0 * * * *"
          />
        </div>

        {/* Current schedule display */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{
            background: 'var(--accent-glow)',
            border: '1px solid rgba(52, 211, 153, 0.2)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--accent)' }}>
                {humanSchedule}
              </div>
              <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--textMuted)', marginTop: '0.15rem' }}>
                {schedule}
              </div>
            </div>
          </div>
        </div>

        {/* Preset buttons */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--textMuted)', marginBottom: '0.5rem', fontWeight: 500 }}>
            Quick presets
          </label>
          <div className="btn-group">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`btn ${schedule === p.value ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setSchedule(p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <hr className="divider" />

        {/* Info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--textMuted)' }}>
            Last cron run: {config.last_run_at ? (
              <span style={{ color: 'var(--text)' }}>{new Date(config.last_run_at).toLocaleString()}</span>
            ) : (
              <span>Never</span>
            )}
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? <><span className="spinner"></span> Saving&hellip;</> : 'Save Schedule'}
          </button>
        </div>
      </div>

      {/* Help */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>Cron Expression Reference</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Allowed Values</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="mono">*</td><td>any</td><td>Matches every value</td></tr>
              <tr><td className="mono">*/n</td><td>interval</td><td>Every n units</td></tr>
              <tr><td className="mono">0 * * * *</td><td>\u2014</td><td>At minute 0 of every hour</td></tr>
              <tr><td className="mono">0 0 * * *</td><td>\u2014</td><td>Daily at midnight</td></tr>
              <tr><td className="mono">0 */6 * * *</td><td>\u2014</td><td>Every 6 hours</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default Cron;
