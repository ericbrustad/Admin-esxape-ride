import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <pre style={{ maxWidth: 560, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </main>
      );
    }

    return this.props.children;
  }
}

export default function Home() {
  return (
    <ErrorBoundary>
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <div style={{ padding: 24, border: '1px solid #ccc', borderRadius: 12, background: '#fff' }}>
          <h1 style={{ margin: 0 }}>Game UI Smoke Test</h1>
          <p style={{ marginTop: 12 }}>If you can read this, React rendered.</p>
          <p style={{ marginTop: 12, fontSize: 13, color: '#555' }}>
            Legacy mission rendering is temporarily paused while we debug the black screen regression. Re-enable by restoring
            <code style={{ marginLeft: 4 }}>pages/index.legacy.jsx</code> once the data flow is healthy.
          </p>
        </div>
      </main>
    </ErrorBoundary>
  );
}

/*
 * The previous interactive mission runner has been preserved for quick restoration.
 * Copy the contents of pages/index.legacy.jsx over this smoke test once the Supabase
 * data pipeline is confirmed healthy again.
 */
