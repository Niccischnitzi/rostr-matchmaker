// Theme controller: reads pref from localStorage and applies `.dark` class to <html>.
// Also bootstraps the customization (accent/background/font/density) layer.

import { initCustomizationListeners } from "./customization";

const SETTINGS_KEY = "rostr:settings";
type Pref = "dark" | "light" | "system";

function readPref(): Pref {
  if (typeof window === "undefined") return "system";
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return "system";
    const parsed = JSON.parse(raw);
    const t = parsed?.theme;
    return t === "dark" || t === "light" || t === "system" ? t : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

export function applyTheme() {
  if (typeof document === "undefined") return;
  const pref = readPref();
  const dark = pref === "dark" || (pref === "system" && systemPrefersDark());
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
}

export function initThemeListeners() {
  if (typeof window === "undefined") return () => {};
  applyTheme();
  const offCustom = initCustomizationListeners();
  const onSettings = () => applyTheme();
  window.addEventListener("rostr:settings-changed", onSettings);
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onSystem = () => applyTheme();
  mq?.addEventListener?.("change", onSystem);
  return () => {
    window.removeEventListener("rostr:settings-changed", onSettings);
    mq?.removeEventListener?.("change", onSystem);
    offCustom();
  };
}
