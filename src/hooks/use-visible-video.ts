import { useEffect, useRef, useState } from "react";

/**
 * Auto-plays a video while it's visible in the viewport (>= threshold)
 * and pauses when it scrolls away or the tab/page becomes hidden.
 */
export function useVisibleVideo(opts?: { threshold?: number; autoplay?: boolean }) {
  const threshold = opts?.threshold ?? 0.6;
  const autoplay = opts?.autoplay ?? true;
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const tryPlay = () => {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    };
    const doPause = () => {
      el.pause();
      setPlaying(false);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const visible = e.intersectionRatio >= threshold;
          visibleRef.current = visible;
          if (visible && autoplay && !document.hidden) tryPlay();
          else doPause();
        }
      },
      { threshold: [0, threshold, 1] }
    );
    io.observe(el);

    const onVis = () => {
      if (document.hidden) doPause();
      else if (visibleRef.current && autoplay) tryPlay();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      doPause();
    };
  }, [threshold, autoplay]);

  return { ref, playing, setPlaying };
}
