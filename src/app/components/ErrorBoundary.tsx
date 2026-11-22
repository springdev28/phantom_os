import { Component } from 'react';
import type { ReactNode } from 'react';
import { logger } from '../logger';

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { logger.record('render.error'); }
  render() {
    if (this.state.failed) return <main className="fatal-error">
      <p className="eyebrow">PHANTOM OS</p><h1>This view could not load.</h1>
      <p>Your original files are unchanged. Reload to start a fresh temporary session.</p>
      <button className="button button-primary" onClick={() => window.location.reload()}>Reload application</button>
    </main>;
    return this.props.children;
  }
}
