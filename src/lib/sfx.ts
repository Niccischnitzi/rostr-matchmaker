/**
 * Lightweight Web-Audio SFX. No assets, generated tones with a gaming feel.
 * Respects user pref stored in localStorage as "rostr:sfx" === "off".
 */
let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try { ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); }
    catch { return null; }
  }
  return ctx;
}
function enabled() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("rostr:sfx") !== "off";
}

function blip(freq: number, dur = 0.08, type: OscillatorType = "square", vol = 0.06) {
  if (!enabled()) return;
  const ac = getCtx(); if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ac.currentTime);
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination);
  o.start();
  o.stop(ac.currentTime + dur);
}

export const sfx = {
  tap:    () => blip(620, 0.05, "square", 0.04),
  nav:    () => { blip(440, 0.06); setTimeout(() => blip(660, 0.06), 50); },
  like:   () => { blip(880, 0.08, "triangle", 0.07); setTimeout(() => blip(1180, 0.08, "triangle", 0.07), 60); },
  send:   () => blip(720, 0.07, "sine", 0.05),
  error:  () => blip(180, 0.18, "sawtooth", 0.05),
  win:    () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.1, "triangle", 0.07), i * 70)); },
};
