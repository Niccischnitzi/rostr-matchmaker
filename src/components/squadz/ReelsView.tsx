// Sprint 3 — vertical snap-scroll Reels feed (TikTok-style).
// Autoplays when visible, pauses when scrolled away or tab hidden.
// Side rail: like, comment, save, mute. Comment panel slides in from bottom.
import { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, Bookmark, Volume2, VolumeX, Send, Play, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVisibleVideo } from "@/hooks/use-visible-video";
import { sfx } from "@/lib/sfx";
import { toast } from "sonner";

type ReelPost = {
  id: string;
  user_id: string;
  title: string | null;
  game: string | null;
  media_path: string | null;
  created_at: string;
};
type MediaComment = { id: string; post_id: string; user_id: string; body: string; created_at: string };

export function ReelsView({ onClose }: { onClose?: () => void } = {}) {
  const qc = useQueryClient();
  const [muted, setMuted] = useState(false);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);

  // Fullscreen mode: lock body scroll + flag for hiding bottom nav.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.reelsFullscreen = "true";
    return () => {
      document.body.style.overflow = prev;
      delete document.documentElement.dataset.reelsFullscreen;
    };
  }, []);

  // ESC closes
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<ReelPost[]>({
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
    staleTime: 60_000,
  });

  const postIds = useMemo(() => posts.map((p) => p.id), [posts]);
  const postIdsKey = postIds.join(",");

  const paths = useMemo(() => posts.map((p) => p.media_path).filter((p): p is string => !!p), [posts]);
  // Sign URLs in one batch for speed
  const { data: signedMap = {} } = useQuery<Record<string, string>>({
    queryKey: ["reels-signed", paths.join("|")],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const out: Record<string, string> = {};
      const { data } = await supabase.storage.from("media-clips").createSignedUrls(paths, 60 * 60);
      data?.forEach((d) => { if (d.signedUrl && d.path) out[d.path] = d.signedUrl; });
      return out;
    },
  });

  // Scoped to current post set — much smaller payloads than fetching all.
  const { data: likes = [] } = useQuery<{ post_id: string; user_id: string }[]>({
    queryKey: ["media-likes", postIdsKey],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("media_likes").select("post_id, user_id").in("post_id", postIds);
      if (error) throw error;
      return data as any;
    },
  });
  const { data: saves = [] } = useQuery<{ post_id: string; user_id: string }[]>({
    queryKey: ["media-saves", userId, postIdsKey],
    enabled: !!userId && postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("media_saves" as any).select("post_id, user_id").eq("user_id", userId).in("post_id", postIds);
      if (error) throw error;
      return data as any;
    },
  });
  const { data: commentCountsArr = [] } = useQuery<{ post_id: string }[]>({
    queryKey: ["media-comment-counts", postIdsKey],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("media_comments" as any).select("post_id").in("post_id", postIds);
      if (error) throw error;
      return data as any;
    },
  });

  const likeCounts = useMemo(() => {
    const m = new Map<string, number>();
    likes.forEach((l) => m.set(l.post_id, (m.get(l.post_id) ?? 0) + 1));
    return m;
  }, [likes]);
  const commentCounts = useMemo(() => {
    const m = new Map<string, number>();
    commentCountsArr.forEach((c) => m.set(c.post_id, (m.get(c.post_id) ?? 0) + 1));
    return m;
  }, [commentCountsArr]);
  const myLikes = useMemo(() => new Set(likes.filter((l) => l.user_id === userId).map((l) => l.post_id)), [likes, userId]);
  const mySaves = useMemo(() => new Set(saves.map((s) => s.post_id)), [saves]);

  const requireAuth = () => {
    if (!userId) { toast.error("Sign in to interact"); return false; }
    return true;
  };

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error("auth");
      if (myLikes.has(postId)) {
        await supabase.from("media_likes").delete().eq("user_id", userId).eq("post_id", postId);
      } else {
        await supabase.from("media_likes").insert({ user_id: userId, post_id: postId });
        sfx.like();
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-likes"] }),
  });
  const toggleSave = useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error("auth");
      if (mySaves.has(postId)) {
        await supabase.from("media_saves" as any).delete().eq("user_id", userId).eq("post_id", postId);
      } else {
        await supabase.from("media_saves" as any).insert({ user_id: userId, post_id: postId } as any);
        sfx.tap();
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-saves"] }),
  });

  // Portal to <body> so `position: fixed` is NOT trapped by an ancestor
  // with `will-change: transform` (the Shell swipe wrapper creates a
  // containing block, which collapsed our fullscreen reel viewport).
  const overlay = (
    <div className="fixed inset-0 z-[100] bg-black" style={{ height: "100svh", width: "100vw" }}>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close reels"
          className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-black/60 backdrop-blur grid place-items-center text-white hover:bg-black/80"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {postsLoading && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="h-12 w-12 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
        </div>
      )}

      {!postsLoading && posts.length === 0 && (
        <div className="absolute inset-0 grid place-items-center text-white/70 text-sm">
          No reels yet — be the first.
        </div>
      )}

      <div
        className="h-full w-full overflow-y-auto snap-y snap-mandatory"
        style={{ scrollSnapStop: "always" as React.CSSProperties["scrollSnapStop"] }}
      >
        {posts.map((p, i) => (
          <Reel
            key={p.id}
            post={p}
            src={p.media_path ? signedMap[p.media_path] : undefined}
            eager={i < 2}
            muted={muted}
            onToggleMute={() => setMuted((m) => !m)}
            onAutoplayMuted={() => setMuted(true)}
            liked={myLikes.has(p.id)}
            saved={mySaves.has(p.id)}
            likeCount={likeCounts.get(p.id) ?? 0}
            commentCount={commentCounts.get(p.id) ?? 0}
            onLike={() => { if (requireAuth()) toggleLike.mutate(p.id); }}
            onSave={() => { if (requireAuth()) toggleSave.mutate(p.id); }}
            onComment={() => setCommentsFor(p.id)}
          />
        ))}
      </div>

      {/* Comments panel — rendered INSIDE the reels portal so it stacks above */}
      <CommentsPanel
        postId={commentsFor}
        onClose={() => setCommentsFor(null)}
        userId={userId ?? null}
      />
    </div>
  );

  return typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
}


function Reel({
  post, src, eager, muted, onToggleMute, onAutoplayMuted,
  liked, saved, likeCount, commentCount,
  onLike, onSave, onComment,
}: {
  post: ReelPost;
  src: string | undefined;
  eager: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onAutoplayMuted: () => void;
  liked: boolean;
  saved: boolean;
  likeCount: number;
  commentCount: number;
  onLike: () => void;
  onSave: () => void;
  onComment: () => void;
}) {
  const { ref, playing, setPlaying } = useVisibleVideo({ threshold: 0.6, onAutoplayMuted });
  const [tapPause, setTapPause] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className="relative h-full w-full snap-start snap-always grid place-items-center" style={{ willChange: "transform" }}>
      {src && !errored ? (
        <video
          ref={ref}
          src={src}
          loop
          muted={muted}
          playsInline
          preload={eager ? "auto" : "metadata"}
          className="h-full w-full object-contain bg-black"
          onError={() => setErrored(true)}
          onClick={() => {
            const el = ref.current; if (!el) return;
            if (el.paused) { el.play().catch(() => {}); setPlaying(true); setTapPause(false); }
            else { el.pause(); setPlaying(false); setTapPause(true); }
          }}
        />
      ) : errored ? (
        <div className="text-white/70 text-sm text-center px-6">
          <p>Couldn't load this clip.</p>
          <button onClick={() => setErrored(false)} className="mt-2 text-primary font-bold">Retry</button>
        </div>
      ) : (
        <div className="h-12 w-12 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
      )}

      {!playing && tapPause && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-16 w-16 rounded-full bg-black/50 backdrop-blur grid place-items-center">
            <Play className="h-8 w-8 text-white fill-current ml-1" />
          </div>
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute inset-x-0 bottom-0 p-3 pr-16 bg-gradient-to-t from-black/85 to-transparent text-white">
        {post.title && <p className="font-display text-base sm:text-lg font-black drop-shadow line-clamp-2">{post.title}</p>}
        {post.game && <p className="text-[11px] opacity-80 mt-0.5">{post.game}</p>}
      </div>

      {/* Right action rail */}
      <div className="absolute right-2 bottom-20 flex flex-col gap-3 text-white">
        <RailBtn label={likeCount > 0 ? String(likeCount) : "Like"} onClick={onLike} active={liked}>
          <Heart className={cn("h-6 w-6", liked && "fill-current text-primary")} />
        </RailBtn>
        <RailBtn label={commentCount > 0 ? String(commentCount) : "Chat"} onClick={onComment}>
          <MessageCircle className="h-6 w-6" />
        </RailBtn>
        <RailBtn label={saved ? "Saved" : "Save"} onClick={onSave} active={saved}>
          <Bookmark className={cn("h-6 w-6", saved && "fill-current text-primary")} />
        </RailBtn>
        <RailBtn label={muted ? "Sound" : "Mute"} onClick={onToggleMute}>
          {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
        </RailBtn>
      </div>

      <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground">Reel</div>
    </div>
  );
}

function RailBtn({ children, label, onClick, active }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1">
      <span className={cn(
        "h-11 w-11 rounded-full grid place-items-center backdrop-blur transition-colors",
        active ? "bg-white/20" : "bg-black/50"
      )}>
        {children}
      </span>
      <span className="text-[10px] font-bold drop-shadow">{label}</span>
    </button>
  );
}

function CommentsPanel({
  postId, onClose, userId,
}: {
  postId: string | null;
  onClose: () => void;
  userId: string | null;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const open = !!postId;
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: comments = [], isLoading } = useQuery<MediaComment[]>({
    queryKey: ["media-comments", postId],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase.from("media_comments" as any)
        .select("*").eq("post_id", postId).order("created_at", { ascending: true });
      if (error) throw error;
      return data as any;
    },
  });

  const authorIds = useMemo(() => Array.from(new Set(comments.map((c) => c.user_id))), [comments]);
  const { data: authors = [] } = useQuery({
    queryKey: ["reel-comment-authors", authorIds.join(",")],
    enabled: authorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", authorIds);
      return data ?? [];
    },
  });
  const authorMap = useMemo(() => new Map((authors as any[]).map((a) => [a.id, a])), [authors]);

  const add = useMutation({
    mutationFn: async () => {
      if (!userId || !postId) throw new Error("auth");
      const text = draft.trim();
      if (!text) throw new Error("empty");
      await supabase.from("media_comments" as any).insert({ post_id: postId, user_id: userId, body: text.slice(0, 280) } as any);
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["media-comments", postId] });
      qc.invalidateQueries({ queryKey: ["media-comment-counts"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Comment failed"),
  });

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        aria-label="Close comments"
        onClick={onClose}
        className="absolute inset-0 z-[105] bg-black/60 animate-in fade-in"
      />
      {/* Panel */}
      <div
        className="absolute inset-x-0 bottom-0 z-[110] bg-background rounded-t-3xl border-t border-border flex flex-col animate-in slide-in-from-bottom-4 duration-200"
        style={{ height: "60svh", maxHeight: "60svh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">{comments.length} {comments.length === 1 ? "comment" : "comments"}</p>
          <button onClick={onClose} aria-label="Close" className="h-8 w-8 grid place-items-center rounded-full hover:bg-surface-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading && (
            <div className="grid place-items-center py-8">
              <div className="h-6 w-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
            </div>
          )}
          {!isLoading && comments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Be the first to comment.</p>
          )}
          {comments.map((c) => {
            const a = authorMap.get(c.user_id) as any;
            return (
              <div key={c.id} className="flex items-start gap-2">
                <div className="h-8 w-8 shrink-0 rounded-full bg-surface-2 overflow-hidden">
                  {a?.avatar_url && <img src={a.avatar_url} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">@{a?.username ?? "player"}</p>
                  <p className="text-sm break-words">{c.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        {userId ? (
          <div className="p-3 border-t border-border flex items-center gap-2" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && draft.trim()) add.mutate(); }}
              placeholder="Add a comment…"
              maxLength={280}
              className="min-w-0 flex-1 bg-surface rounded-full px-4 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            <button onClick={() => add.mutate()} disabled={!draft.trim() || add.isPending} className="h-10 w-10 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="p-4 text-sm text-center text-muted-foreground border-t border-border">Sign in to comment.</div>
        )}
      </div>
    </>
  );
}
