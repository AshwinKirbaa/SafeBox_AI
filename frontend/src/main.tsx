import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SafeBox AI Crash Caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '32px', fontFamily: 'monospace', color: '#f87171', background: '#05070D', minHeight: '100vh' }}>
          <h1 style={{ color: '#22d3ee', fontSize: '24px' }}>SafeBox AI — Initialization Warning</h1>
          <p style={{ color: '#9aa6bd' }}>An error occurred during component rendering:</p>
          <pre style={{ background: '#0A1022', padding: '16px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', whiteSpace: 'pre-wrap', marginTop: '16px' }}>
            {this.state.error?.message}
            {'\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px', padding: '8px 16px', background: '#22d3ee', color: '#05070D', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
