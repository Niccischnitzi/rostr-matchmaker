import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
  errorComponent: () => <div className="p-6">Something went wrong.</div>,
  notFoundComponent: () => <div className="p-6">Not found.</div>,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center space-y-4 shadow-sm">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="text-2xl font-semibold tracking-tight">Payment received</h1>
        <p className="text-sm text-muted-foreground">
          {session_id
            ? "Thanks! Your account will be credited within a few seconds."
            : "No session details found — if you were charged we'll still process it."}
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Back to Rostr
        </Link>
      </div>
    </div>
  );
}
