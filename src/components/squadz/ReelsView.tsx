// Sprint 3 — vertical snap-scroll Reels feed.
// Renders existing media_posts of kind=video as a TikTok-style snap feed.
// GPU-smooth via scroll-snap + will-change.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Heart, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

type ReelPost = {
  id: string;
  user_id: string;
  title: string | null;
  game: string | null;
  media_path: string | null;
  created_at: string;
};

export function ReelsView() {
  const { data: posts = [] } = useQuery<ReelPost[]>({
    queryKey: ["reels-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_posts")
        .select("id,user_id,title,game,media_path,created_at")
        .eq("kind", "video")
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data ?? []) as ReelPost[];
    },
  });

  const paths = useMemo(() => posts.map((p) => p.media_path).filter((p): p is string => !!p), [posts]);

  const { data: signedMap = {} } = useQuery<Record<string, string>>({
    queryKey: ["reels-signed", paths.join("|")],
    enabled: paths.length > 0,
    queryFn: async () => {
      const out: Record<string, string> = {};
      await Promise.all(paths.map(async (p) => {
        const { data } = await supabase.storage.from("media-clips").createSignedUrl(p, 60 * 60);
        if (data?.signedUrl) out[p] = data.signedUrl;
      }));
      return out;
    },
  });

  if (!posts.length) {
    return <p className="text-center text-sm text-muted-foreground py-16">No reels yet — be the first.</p>;
  }

  return (
    <div
      className="h-[70vh] sm:h-[80vh] rounded-3xl overflow-y-auto snap-y snap-mandatory bg-black border border-border"
      style={{ scrollSnapStop: "always" as React.CSSProperties["scrollSnapStop"] }}
    >
      {posts.map((p, i) => (
        <Reel
          key={p.id}
          post={p}
          src={p.media_path ? signedMap[p.media_path] : undefined}
          eager={i < 2}
        />
      ))}
    </div>
  );
}

function Reel({ post, src, eager }: { post: ReelPost; src: string | undefined; eager: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.intersectionRatio > 0.6) {
            el.play().then(() => setPlaying(true)).catch(() => {});
          } else {
            el.pause();
            setPlaying(false);
          }
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative h-full w-full snap-start snap-always grid place-items-center" style={{ willChange: "transform" }}>
      {src ? (
        <video
          ref={ref}
          src={src}
          loop
          muted={muted}
          playsInline
          preload={eager ? "auto" : "metadata"}
          className="h-full w-full object-contain bg-black"
          onClick={() => {
            const el = ref.current; if (!el) return;
            if (el.paused) { el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); }
          }}
        />
      ) : (
        <div className="text-white/60 text-sm">Loading…</div>
      )}

      <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 to-transparent text-white">
        {post.title && <p className="font-display text-lg font-black drop-shadow">{post.title}</p>}
        {post.game && <p className="text-xs opacity-80">{post.game}</p>}
      </div>

      <div className="absolute right-3 bottom-20 flex flex-col gap-3 text-white">
        <button
          onClick={() => setMuted((m) => !m)}
          className="h-10 w-10 rounded-full bg-black/50 backdrop-blur grid place-items-center"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>
        <button
          onClick={() => {
            const el = ref.current; if (!el) return;
            if (el.paused) { el.play(); setPlaying(true); } else { el.pause(); setPlaying(false); }
          }}
          className="h-10 w-10 rounded-full bg-black/50 backdrop-blur grid place-items-center"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
        </button>
      </div>

      <div className={cn("absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
        "bg-primary text-primary-foreground")}>Reel</div>
    </div>
  );
}
