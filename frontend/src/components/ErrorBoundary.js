import React from 'react';

// Graceful fallback for any uncaught render error.
// Particularly important on smart-TV browsers / old WebKit where a single
// unsupported JS feature could otherwise white-screen or show the red
// dev-mode "Script error." cascade.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: (error && error.message) || 'Something went wrong' };
  }

  componentDidCatch(error, errorInfo) {
    // Log to console for devs. Do NOT re-throw — we already render fallback.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleReload = () => {
    try {
      // Clear stale cache on older browsers that may have half-loaded bundle
      if (window.caches && window.caches.keys) {
        window.caches.keys().then((keys) => keys.forEach((k) => window.caches.delete(k)));
      }
    } catch (e) { /* ignore */ }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#fff5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: 'Arial, sans-serif',
          color: '#111',
        }}
        data-testid="app-error-fallback"
      >
        <div style={{ maxWidth: 560, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h1 style={{ color: '#e92587', fontSize: 28, margin: 0, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: '#555', marginTop: 0, marginBottom: 16 }}>
            The kitchen display hit a temporary glitch. This is usually fixed by a reload.
          </p>
          <p style={{ color: '#888', fontSize: 12, marginBottom: 24, wordBreak: 'break-word' }}>
            {this.state.message}
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            data-testid="app-error-reload-btn"
            style={{
              background: '#e92587',
              color: '#fff',
              border: 'none',
              padding: '12px 32px',
              borderRadius: 999,
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
          <p style={{ color: '#aaa', fontSize: 11, marginTop: 24 }}>
            If this keeps happening on a Smart TV / old browser, please open on Chrome / Edge / phone browser.
          </p>
        </div>
      </div>
    );
  }
}
