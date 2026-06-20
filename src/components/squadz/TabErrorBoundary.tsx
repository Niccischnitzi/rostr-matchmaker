import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null };

/**
 * Catches render/runtime errors inside a single tab so one broken tab
 * never blanks the entire Shell. Replaces the white "page didn't load"
 * screen with an inline retry surface.
 */
export class TabErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[TabErrorBoundary]", this.props.label ?? "", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[50vh] grid place-items-center p-6">
        <div className="max-w-sm w-full rounded-2xl border border-border bg-surface p-6 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 grid place-items-center mb-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <p className="font-display text-lg font-black">Something glitched</p>
          <p className="text-xs text-muted-foreground mt-1 break-words">
            {this.state.error.message || "Unknown error"}
          </p>
          <button
            onClick={this.reset}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      </div>
    );
  }
}
