// Custom theme & UI personalization. Stored in localStorage + applied as CSS vars on :root.
// Keep this file framework-free; consumed by ThemeListeners and the customization UI.

export type AccentKey = "orange" | "violet" | "cyan" | "lime" | "rose" | "amber" | "emerald" | "indigo";
export type BackgroundKey = "void" | "aurora" | "grid" | "noise" | "sunset" | "matrix";
export type DensityKey = "comfy" | "compact";
export type FontKey = "grotesk" | "jakarta" | "bebas" | "serif" | "rounded" | "mono";
export type AnimKey = "smooth" | "snappy" | "reduced";
export type PaletteKey =
  | "crimson-cobalt" | "neon-navy" | "purple-cream" | "party-pinky"
  | "cyber-mint" | "midnight-obsidian" | "slate-minimal" | "sunset-arcade";

export type Customization = {
  accent: AccentKey;
  background: BackgroundKey;
  density: DensityKey;
  fontDensity: DensityKey;
  layoutDensity: DensityKey;
  font: FontKey;
  anim: AnimKey;
  radius: number;
  palette?: PaletteKey | null;
};

export const DEFAULT_CUSTOMIZATION: Customization = {
  accent: "orange",
  background: "void",
  density: "comfy",
  fontDensity: "comfy",
  layoutDensity: "comfy",
  font: "grotesk",
  anim: "smooth",
  radius: 14,
  palette: null,
};

export const ACCENTS: Record<AccentKey, { name: string; primary: string; ring: string; glow: string; swatch: string }> = {
  orange:  { name: "Sunset",  primary: "oklch(0.72 0.22 38)",  ring: "oklch(0.72 0.22 38)",  glow: "oklch(0.78 0.18 55)",  swatch: "#ff7849" },
  violet:  { name: "Nebula",  primary: "oklch(0.66 0.24 295)", ring: "oklch(0.66 0.24 295)", glow: "oklch(0.74 0.18 320)", swatch: "#8b5cf6" },
  cyan:    { name: "Plasma",  primary: "oklch(0.78 0.16 210)", ring: "oklch(0.78 0.16 210)", glow: "oklch(0.86 0.12 195)", swatch: "#22d3ee" },
  lime:    { name: "Toxic",   primary: "oklch(0.86 0.22 132)", ring: "oklch(0.86 0.22 132)", glow: "oklch(0.92 0.18 120)", swatch: "#a3e635" },
  rose:    { name: "Crimson", primary: "oklch(0.68 0.24 15)",  ring: "oklch(0.68 0.24 15)",  glow: "oklch(0.78 0.20 30)",  swatch: "#f43f5e" },
  amber:   { name: "Gold",    primary: "oklch(0.82 0.18 80)",  ring: "oklch(0.82 0.18 80)",  glow: "oklch(0.88 0.14 90)",  swatch: "#f59e0b" },
  emerald: { name: "Forest",  primary: "oklch(0.7 0.18 152)",  ring: "oklch(0.7 0.18 152)",  glow: "oklch(0.78 0.14 162)", swatch: "#10b981" },
  indigo:  { name: "Cobalt",  primary: "oklch(0.62 0.22 265)", ring: "oklch(0.62 0.22 265)", glow: "oklch(0.72 0.18 275)", swatch: "#6366f1" },
};

export const BACKGROUNDS: Record<BackgroundKey, { name: string; css: string }> = {
  void: {
    name: "Void",
    css: "radial-gradient(1200px 600px at 100% -10%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 60%), radial-gradient(900px 500px at -10% 110%, color-mix(in oklab, var(--primary) 10%, transparent), transparent 60%), var(--background)",
  },
  aurora: {
    name: "Aurora",
    css: "linear-gradient(135deg, color-mix(in oklab, var(--primary) 18%, var(--background)), var(--background) 60%), radial-gradient(800px 600px at 80% 20%, color-mix(in oklab, #22d3ee 22%, transparent), transparent 60%), radial-gradient(700px 500px at 10% 80%, color-mix(in oklab, #8b5cf6 22%, transparent), transparent 60%), var(--background)",
  },
  grid: {
    name: "Arcade Grid",
    css: "linear-gradient(var(--background), var(--background)), linear-gradient(color-mix(in oklab, var(--primary) 22%, transparent) 1px, transparent 1px) 0 0/32px 32px, linear-gradient(90deg, color-mix(in oklab, var(--primary) 22%, transparent) 1px, transparent 1px) 0 0/32px 32px, var(--background)",
  },
  noise: {
    name: "Grain",
    css: "radial-gradient(1000px 600px at 50% 0%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 70%), url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\"), var(--background)",
  },
  sunset: {
    name: "Sunset",
    css: "linear-gradient(180deg, color-mix(in oklab, #f59e0b 18%, var(--background)) 0%, color-mix(in oklab, #f43f5e 12%, var(--background)) 50%, var(--background) 100%)",
  },
  matrix: {
    name: "Matrix",
    css: "linear-gradient(180deg, var(--background) 0%, color-mix(in oklab, #10b981 14%, var(--background)) 100%), repeating-linear-gradient(0deg, transparent 0 30px, color-mix(in oklab, #10b981 8%, transparent) 30px 31px)",
  },
};

export const FONT_FAMILIES: Record<FontKey, { name: string; family: string }> = {
  grotesk: { name: "Grotesk",  family: '"Space Grotesk", "Inter", sans-serif' },
  jakarta: { name: "Jakarta",  family: '"Plus Jakarta Sans", "Inter", sans-serif' },
  bebas:   { name: "Bebas",    family: '"Bebas Neue", "Inter", sans-serif' },
  serif:   { name: "Serif",    family: '"Fraunces", "Times New Roman", serif' },
  rounded: { name: "Rounded",  family: '"Nunito", "Inter", sans-serif' },
  mono:    { name: "Mono",     family: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace' },
};

// One-click paired presets — mode + accent + background combined.
export type PalettePreset = {
  name: string;
  mode: "dark" | "light";
  accent: AccentKey;
  background: BackgroundKey;
  gradient: string;
};

export const PALETTES: Record<PaletteKey, PalettePreset> = {
  "crimson-cobalt":    { name: "Crimson Cobalt",    mode: "dark",  accent: "rose",    background: "aurora", gradient: "linear-gradient(135deg, #f43f5e 0%, #8b5cf6 50%, #6366f1 100%)" },
  "neon-navy":         { name: "Neon Navy",         mode: "dark",  accent: "cyan",    background: "grid",   gradient: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 55%, #1e3a8a 100%)" },
  "purple-cream":      { name: "Purple Cream",      mode: "light", accent: "violet",  background: "noise",  gradient: "linear-gradient(135deg, #8b5cf6 0%, #c4b5fd 55%, #fdf4ff 100%)" },
  "party-pinky":       { name: "Party Pinky",       mode: "dark",  accent: "rose",    background: "sunset", gradient: "linear-gradient(135deg, #ff7849 0%, #f43f5e 50%, #ec4899 100%)" },
  "cyber-mint":        { name: "Cyber Mint",        mode: "dark",  accent: "emerald", background: "matrix", gradient: "linear-gradient(135deg, #0fffbe 0%, #10b981 55%, #0f766e 100%)" },
  "midnight-obsidian": { name: "Midnight Obsidian", mode: "dark",  accent: "indigo",  background: "void",   gradient: "linear-gradient(135deg, #1f1f23 0%, #4338ca 60%, #6366f1 100%)" },
  "slate-minimal":     { name: "Slate Minimal",     mode: "light", accent: "indigo",  background: "noise",  gradient: "linear-gradient(135deg, #e2e8f0 0%, #94a3b8 55%, #6366f1 100%)" },
  "sunset-arcade":     { name: "Sunset Arcade",     mode: "dark",  accent: "orange",  background: "sunset", gradient: "linear-gradient(135deg, #fde047 0%, #ff7849 50%, #f43f5e 100%)" },
};

// Curated avatar presets used everywhere a profile picture is chosen.
export const AVATAR_PACKS = {
  bots: ["nova", "ghost", "kairo", "lyric", "vexen", "halcyon", "blaze", "pixel"],
  monsters: ["echo", "raven", "zenith", "frost", "ember", "drift", "vortex", "ion"],
  pixels: ["arcade", "neon", "synth", "wave", "coin", "boss", "level", "respawn"],
} as const;

export type AvatarPack = keyof typeof AVATAR_PACKS;

export const AVATAR_STYLES: { key: AvatarPack; name: string; build: (seed: string) => string }[] = [
  { key: "bots",     name: "Bots",     build: (s) => `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${s}&backgroundColor=ff5722,ff8a4c,1f1f23,2d2d33` },
  { key: "monsters", name: "Monsters", build: (s) => `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${s}` },
  { key: "pixels",   name: "Pixels",   build: (s) => `https://api.dicebear.com/9.x/pixel-art/svg?seed=${s}` },
];

export function buildAvatarUrl(pack: AvatarPack, seed: string): string {
  const style = AVATAR_STYLES.find((s) => s.key === pack) ?? AVATAR_STYLES[0];
  return style.build(seed);
}

export const ALL_AVATAR_PRESETS: { pack: AvatarPack; seed: string; url: string }[] = AVATAR_STYLES.flatMap((s) =>
  AVATAR_PACKS[s.key].map((seed) => ({ pack: s.key, seed, url: s.build(seed) }))
);

const KEY = "rostr:custom";

export function loadCustomization(): Customization {
  if (typeof window === "undefined") return DEFAULT_CUSTOMIZATION;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_CUSTOMIZATION, ...JSON.parse(raw) } : DEFAULT_CUSTOMIZATION;
  } catch { return DEFAULT_CUSTOMIZATION; }
}

export function saveCustomization(c: Customization) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(c));
  applyCustomization(c);
  window.dispatchEvent(new Event("rostr:custom-changed"));
}

// Live preview without persisting — used by the customizer panel.
export function previewCustomization(c: Customization) {
  applyCustomization(c);
}

export function applyCustomization(c: Customization = loadCustomization()) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const accent = ACCENTS[c.accent] ?? ACCENTS.orange;

  // Apply accent tokens to <html> AND every `.dark` wrapper element. Some
  // routes wrap their tree in <div className="dark"> (see routes/index.tsx),
  // and CSS variables on a closer ancestor would otherwise beat ours.
  const targets: HTMLElement[] = [root, ...Array.from(document.querySelectorAll<HTMLElement>(".dark"))];
  const accentSurface = `color-mix(in oklab, ${accent.primary} 18%, var(--background))`;
  const palette = c.palette ? PALETTES[c.palette] : null;
  const paletteHexes = palette ? (palette.gradient.match(/#[0-9a-fA-F]{3,8}/g) ?? []) : [];
  const ringColors: string[] = paletteHexes.length >= 2
    ? [paletteHexes[0], paletteHexes[1] ?? paletteHexes[0], paletteHexes[2] ?? paletteHexes[0], paletteHexes[0]]
    : [accent.primary, accent.glow, accent.primary, accent.glow];
  for (const el of targets) {
    el.style.setProperty("--primary", accent.primary);
    el.style.setProperty("--primary-foreground", "oklch(0.08 0 0)");
    el.style.setProperty("--primary-glow", accent.glow);
    el.style.setProperty("--ring", accent.ring);
    el.style.setProperty("--accent", accentSurface);
    el.style.setProperty("--accent-foreground", accent.primary);
    el.style.setProperty("--ring-c1", ringColors[0]);
    el.style.setProperty("--ring-c2", ringColors[1]);
    el.style.setProperty("--ring-c3", ringColors[2]);
    el.style.setProperty("--ring-c4", ringColors[3]);
  }


  root.style.setProperty("--radius", `${c.radius / 16}rem`);
  // Apply chosen font GLOBALLY: --font-sans drives <body>, --font-display drives headings.
  const fontFamily = FONT_FAMILIES[c.font].family;
  root.style.setProperty("--font-display", fontFamily);
  root.style.setProperty("--font-sans", fontFamily);

  // Background painted on <html> via CSS var.
  root.style.setProperty("--app-bg-image", BACKGROUNDS[c.background].css);

  // Density => global spacing scale via a custom prop consumers can use.
  root.style.setProperty("--density-scale", c.density === "compact" ? "0.92" : "1");

  // Animation speed multiplier (consumed by motion-aware utilities).
  const speed = c.anim === "snappy" ? "0.65" : c.anim === "reduced" ? "0.001" : "1";
  root.style.setProperty("--motion-scale", speed);

  root.dataset.density = c.density;
  root.dataset.fontDensity = c.fontDensity ?? c.density;
  root.dataset.layoutDensity = c.layoutDensity ?? c.density;
  root.dataset.anim = c.anim;
  root.dataset.accent = c.accent;
  root.dataset.background = c.background;
  root.dataset.font = c.font;
  if (c.palette) root.dataset.palette = c.palette; else delete root.dataset.palette;
}

/** Apply a named palette preset: theme mode + accent + background atomically. */
export function applyPalettePreset(key: PaletteKey) {
  if (typeof window === "undefined") return;
  const preset = PALETTES[key];
  if (!preset) return;
  try {
    const raw = localStorage.getItem("rostr:settings");
    const parsed = raw ? JSON.parse(raw) : {};
    parsed.theme = preset.mode;
    localStorage.setItem("rostr:settings", JSON.stringify(parsed));
  } catch {}
  document.documentElement.classList.toggle("dark", preset.mode === "dark");
  document.documentElement.style.colorScheme = preset.mode;
  window.dispatchEvent(new Event("rostr:settings-changed"));
  const current = loadCustomization();
  saveCustomization({ ...current, accent: preset.accent, background: preset.background, palette: key });
}

export function initCustomizationListeners() {
  if (typeof window === "undefined") return () => {};
  applyCustomization();
  const onChange = () => applyCustomization();
  window.addEventListener("rostr:custom-changed", onChange);
  return () => window.removeEventListener("rostr:custom-changed", onChange);
}
