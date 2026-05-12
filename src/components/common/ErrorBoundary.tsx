import React from 'react';
import { AlertOctagon, RefreshCw, Trash2 } from 'lucide-react';

// Top-level error boundary. Catches render-time exceptions so the user gets
// a recoverable screen instead of a white page. Two recovery paths:
//   1. Reload — soft recovery, keeps localStorage intact
//   2. Clear local data — nukes the persisted Zustand store. Use when the
//      state itself is the problem (corrupted, broken schema, etc.).

interface State {
  hasError: boolean;
  error: unknown;
  errorInfo: { componentStack?: string } | null;
}

interface Props {
  children: React.ReactNode;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, errorInfo: { componentStack?: string }) {
    // Logged loudly so the rep can grab the stack from devtools and tell us
    // what happened on the next crash.
    // eslint-disable-next-line no-console
    console.error('[Sales-Hub crash]', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearLocalData = () => {
    const ok = window.confirm(
      'Clear all local data and reload? This resets the demo to seed defaults — any rep-entered edits will be lost.',
    );
    if (!ok) return;
    try {
      window.localStorage.removeItem('sales-hub-store');
    } catch {
      /* swallow */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const message = this.state.error instanceof Error
      ? this.state.error.message
      : String(this.state.error ?? 'Unknown error');

    return (
      <div className="min-h-screen w-full bg-bg text-fg flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-surface border border-danger/40 rounded-xl p-6 shadow-panel">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-danger/15 border border-danger/30 flex items-center justify-center shrink-0">
              <AlertOctagon size={20} className="text-danger" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-semibold text-fg">Something broke.</h1>
              <p className="text-xs text-fg-muted mt-1">
                Reload to recover. If it crashes again right away, the local data may be the problem —
                use "Clear local data" to reset the demo to seed defaults.
              </p>
            </div>
          </div>
          <pre className="mt-4 bg-bg border border-divider rounded-lg p-3 text-xs text-fg-muted overflow-x-auto whitespace-pre-wrap break-words">
            {message}
          </pre>
          <div className="flex gap-2 mt-4">
            <button
              onClick={this.handleReload}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dim"
            >
              <RefreshCw size={14} /> Reload
            </button>
            <button
              onClick={this.handleClearLocalData}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm text-fg-muted border border-divider rounded-lg hover:bg-surface-1 hover:text-danger hover:border-danger/40"
            >
              <Trash2 size={14} /> Clear local data
            </button>
          </div>
          <p className="text-xs text-fg-faint mt-3">
            Drop the stack trace above into a message to the dev so they can repro.
          </p>
        </div>
      </div>
    );
  }
}
