import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * Sentry-style top-level error boundary. Catches uncaught render errors,
 * forwards them to the error-reporting sink, and renders a recovery UI.
 * Wraps <Outlet /> in __root.tsx so runtime errors don't blank the app.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error(error, { boundary: "AppErrorBoundary", componentStack: info.componentStack });
    reportLovableError(error, { boundary: "AppErrorBoundary" });
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error occurred. Our team has been notified.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <button
              onClick={this.reset}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Try again
            </button>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
