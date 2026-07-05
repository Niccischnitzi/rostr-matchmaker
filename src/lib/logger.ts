/**
 * Lightweight logger that quiets noisy debug output in production and forwards
 * errors to the app's error-reporting sink. Swap the `report` implementation
 * for Sentry / LogRocket / Datadog when a real provider is wired up.
 */
import { reportLovableError } from "./lovable-error-reporting";

const isDev =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV) ??
  process.env.NODE_ENV !== "production";

type LogArgs = unknown[];

function fmt(scope: string | undefined, args: LogArgs): LogArgs {
  return scope ? [`[${scope}]`, ...args] : args;
}

export const logger = {
  debug(...args: LogArgs) {
    if (isDev) console.debug(...args);
  },
  info(...args: LogArgs) {
    if (isDev) console.info(...args);
  },
  warn(...args: LogArgs) {
    console.warn(...args);
  },
  error(err: unknown, meta?: Record<string, unknown>) {
    // Always log locally; forward to error-reporting sink.
    console.error(err, meta);
    try {
      const e = err instanceof Error ? err : new Error(String(err));
      reportLovableError(e, { source: "logger", ...(meta ?? {}) });
    } catch {
      // never let logging throw
    }
  },
  scoped(scope: string) {
    return {
      debug: (...a: LogArgs) => isDev && console.debug(...fmt(scope, a)),
      info: (...a: LogArgs) => isDev && console.info(...fmt(scope, a)),
      warn: (...a: LogArgs) => console.warn(...fmt(scope, a)),
      error: (err: unknown, meta?: Record<string, unknown>) =>
        logger.error(err, { scope, ...(meta ?? {}) }),
    };
  },
};

export type Logger = typeof logger;
