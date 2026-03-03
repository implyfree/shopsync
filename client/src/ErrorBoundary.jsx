import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info);
  }

  render() {
    if (this.state.error) {
      const msg = String(this.state.error?.message || this.state.error);
      return (
        <div style={{
          padding: '2rem',
          maxWidth: 560,
          margin: '2rem auto',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}>
          <h1 style={{ color: 'var(--danger)', marginTop: 0, fontSize: '1.25rem' }}>Something went wrong</h1>
          <p style={{ color: 'var(--textMuted)', wordBreak: 'break-word', fontSize: '0.88rem' }}>{msg}</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => window.location.href = '/'}
            >
              Go to Dashboard
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => window.location.href = '/settings'}
            >
              Settings
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
