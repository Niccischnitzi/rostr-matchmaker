// Applies the user's theme preference (dark / light / system) to the root <html>.
// Listens for "rostr:settings-changed" so Settings updates take effect instantly.

type ThemeMode = "dark" | "light" | "system";

const KEY = "rostr:settings";

function readMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const t = parsed?.theme;
    return t === "light" || t === "dark" || t === "system" ? t : "dark";
  } catch {
    return "dark";
  }
}

function resolveMode(mode: ThemeMode): "dark" | "light" {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyThemeMode() {
  if (typeof document === "undefined") return;
  const resolved = resolveMode(readMode());
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.dataset.themeMode = resolved;
  root.style.colorScheme = resolved;
}

export function getResolvedThemeMode(): "dark" | "light" {
  return resolveMode(readMode());
}

export function initThemeMode() {
  if (typeof window === "undefined") return () => {};
  applyThemeMode();
  const onChange = () => applyThemeMode();
  window.addEventListener("rostr:settings-changed", onChange);
  window.addEventListener("storage", onChange);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("rostr:settings-changed", onChange);
    window.removeEventListener("storage", onChange);
    mq.removeEventListener("change", onChange);
  };
}
