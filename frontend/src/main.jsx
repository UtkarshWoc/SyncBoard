import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';

// Error boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', background: '#111', padding: '2rem', fontFamily: 'monospace' }}>
          <h1>Error</h1>
          <pre>{this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

let App;
try {
  App = (await import('./App')).default;
} catch (err) {
  console.error('Import error:', err);
  App = () => (
    <div style={{ color: 'red', background: '#111', padding: '2rem', fontFamily: 'monospace' }}>
      <h1>Import Error</h1>
      <pre>{err?.toString()}</pre>
      <pre>{err?.stack}</pre>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
