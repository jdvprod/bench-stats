/** Keeps one broken screen from blanking the whole app. Data is never touched; the coach can go back or reload. */
import { Component, ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode; resetKey?: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { try { console.error("Benchboard screen error:", err); } catch { /* ignore */ } }
  componentDidUpdate(prev: { resetKey?: string }) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
  render() {
    if (!this.state.err) return this.props.children;
    return <div className="page"><section className="card" style={{ maxWidth: 560 }}>
      <h2>This screen hit a problem</h2>
      <p className="muted" style={{ margin: "6px 0 12px" }}>Your stats are saved. Go back to Track, or reload the app. If it keeps happening, tell us what you tapped.</p>
      <p className="small muted" style={{ fontFamily: "ui-monospace,monospace", marginBottom: 12 }}>{String(this.state.err.message || this.state.err).slice(0, 160)}</p>
      <div className="row"><button className="btn primary" onClick={() => { location.hash = "#/track"; this.setState({ err: null }); }}>Go to Track</button><button className="btn" onClick={() => location.reload()}>Reload</button></div>
    </section></div>;
  }
}
