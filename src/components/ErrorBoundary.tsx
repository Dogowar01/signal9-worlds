import { Component, type ReactNode } from 'react';

/** Keeps one broken page from blanking the whole app. Reset by changing `resetKey` (e.g. the route). */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="empty-state">
        <h2>This page hit an error</h2>
        <p className="muted">Your data is safe. Try another page, or reload.</p>
        <pre className="snapshot-text" style={{ maxWidth: 640, textAlign: 'left' }}>{this.state.error.message}</pre>
        <button className="btn" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
