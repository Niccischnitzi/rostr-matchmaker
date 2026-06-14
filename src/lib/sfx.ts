/**
 * Lightweight Web-Audio SFX. Subtle, soft tones — no harsh edges.
 * Honors the Settings sheet "Play sound effects" toggle, stored in
 * localStorage under "rostr:settings".sound (boolean, default true).
 */
let ctx: AudioContext | null = null;
let masterFilter: BiquadFilterNode | null = null;
let cachedEnabled: boolean | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      masterFilter = ctx.createBiquadFilter();
      masterFilter.type = "lowpass";
      masterFilter.frequency.value = 2200;
      masterFilter.Q.value = 0.4;
      masterFilter.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  return ctx;
}

function readEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("rostr:settings");
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return parsed?.sound !== false;
  } catch {
    return true;
  }
}

function enabled(): boolean {
  if (cachedEnabled === null) cachedEnabled = readEnabled();
  return cachedEnabled;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "rostr:settings") cachedEnabled = readEnabled();
  });
  // Same-tab updates: SettingsSheet writes to localStorage on every change.
  // Poll a tiny invalidator via custom event so we react instantly.
  window.addEventListener("rostr:settings-changed", () => {
    cachedEnabled = readEnabled();
  });
}

/** Soft tone with attack/release envelope, routed through the master lowpass. */
function tone(
  freq: number,
  dur = 0.09,
  type: OscillatorType = "sine",
  vol = 0.035,
) {
  if (!enabled()) return;
  const ac = getCtx();
  if (!ac || !masterFilter) return;
  const t = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012); // soft attack
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur); // gentle release
  o.connect(g).connect(masterFilter);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  tap: () => tone(520, 0.05, "sine", 0.025),
  nav: () => {
    tone(420, 0.07, "sine", 0.03);
    setTimeout(() => tone(560, 0.07, "sine", 0.025), 55);
  },
  like: () => {
    tone(660, 0.08, "triangle", 0.03);
    setTimeout(() => tone(820, 0.09, "triangle", 0.028), 60);
  },
  send: () => tone(380, 0.07, "sine", 0.028),
  error: () => tone(200, 0.16, "sine", 0.035),
  win: () => {
    [440, 554, 660].forEach((f, i) =>
      setTimeout(() => tone(f, 0.1, "triangle", 0.03), i * 75),
    );
  },
};
