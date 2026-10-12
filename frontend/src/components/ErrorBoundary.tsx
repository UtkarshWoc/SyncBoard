import * as Sentry from '@sentry/react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { FullPageMessage } from './ui';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info);
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <FullPageMessage title="Something went wrong">
        <p className="muted">The page hit an unexpected error. Your board is saved on the server.</p>
        <div className="row gap">
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <a className="btn btn-ghost" href="/">
            Go to my boards
          </a>
        </div>
      </FullPageMessage>
    );
  }
}
