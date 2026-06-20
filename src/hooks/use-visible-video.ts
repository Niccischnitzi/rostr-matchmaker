import { useEffect, useRef, useState } from "react";

/**
 * Auto-plays a video while it's visible in the viewport (>= threshold)
 * and pauses when it scrolls away or the tab/page becomes hidden.
 *
 * Hardened against:
 *  - AbortError from play()/pause() interleave on rapid scroll
 *  - unmount race (sets state on dead component)
 *  - rapid IntersectionObserver chatter (debounced)
 */
export function useVisibleVideo(opts?: { threshold?: number; autoplay?: boolean; onAutoplayMuted?: () => void }) {
  const threshold = opts?.threshold ?? 0.6;
  const autoplay = opts?.autoplay ?? true;
  const onAutoplayMuted = opts?.onAutoplayMuted;
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const visibleRef = useRef(false);
  const mountedRef = useRef(true);
  const pendingPlayRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const el = ref.current;
    if (!el) return;

    const safeSet = (v: boolean) => { if (mountedRef.current) setPlaying(v); };

    const tryPlay = async () => {
      if (!el || el.paused === false) return;
      try {
        const p = el.play();
        pendingPlayRef.current = p as Promise<void>;
        await p;
        safeSet(true);
      } catch {
        // Autoplay with sound is often blocked — fall back to muted playback.
        try {
          el.muted = true;
          onAutoplayMuted?.();
          const p2 = el.play();
          pendingPlayRef.current = p2 as Promise<void>;
          await p2;
          safeSet(true);
        } catch {
          safeSet(false);
        }
      } finally {
        pendingPlayRef.current = null;
      }
    };
    const doPause = async () => {
      if (!el) return;
      // Wait for any in-flight play() to settle before pausing — avoids AbortError.
      if (pendingPlayRef.current) {
        try { await pendingPlayRef.current; } catch { /* ignore */ }
      }
      try { el.pause(); } catch { /* ignore */ }
      safeSet(false);
    };

    let rafId = 0;
    const schedule = (fn: () => void) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(fn);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const visible = e.intersectionRatio >= threshold;
          visibleRef.current = visible;
          if (visible && autoplay && !document.hidden) schedule(() => { void tryPlay(); });
          else schedule(() => { void doPause(); });
        }
      },
      { threshold: [0, threshold, 1] }
    );
    io.observe(el);

    const onVis = () => {
      if (document.hidden) void doPause();
      else if (visibleRef.current && autoplay) void tryPlay();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      mountedRef.current = false;
      cancelAnimationFrame(rafId);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      void doPause();
    };
  }, [threshold, autoplay]);

  return { ref, playing, setPlaying };
}
