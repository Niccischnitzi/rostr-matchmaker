import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSquadz } from "@/lib/squadz-store";
import { Play, Flame, Eye, Plus, Coins, Loader2, Video as VideoIcon, MessageSquare, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ComposeDialog } from "./ComposeDialog";

type MediaPost = {
  id: string;
  user_id: string;
  kind: "video" | "text" | "tweet";
  title: string | null;
  body: string | null;
  media_path: string | null;
  source_url: string | null;
  game: string | null;
  duration_s: number | null;
  tokens_spent: number;
  created_at: string;
};
type Like = { post_id: string; user_id: string };

export function MediaTab() {
  const qc = useQueryClient();
  const { clips, likeClip, likedClips } = useSquadz();
  const [composeOpen, setComposeOpen] = useState(false);

  const { data: userId } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });

  const { data: posts = [], isLoading } = useQuery<MediaPost[]>({
    queryKey: ["media-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as MediaPost[];
    },
  });

  const { data: likes = [] } = useQuery<Like[]>({
    queryKey: ["media-likes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("media_likes").select("post_id, user_id");
      if (error) throw error;
      return data as Like[];
    },
  });

  const likeCounts = useMemo(() => {
    const m = new Map<string, number>();
    likes.forEach((l) => m.set(l.post_id, (m.get(l.post_id) ?? 0) + 1));
    return m;
  }, [likes]);

  const myLikes = useMemo(() => {
    return new Set(likes.filter((l) => l.user_id === userId).map((l) => l.post_id));
  }, [likes, userId]);

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error("Not signed in");
      if (myLikes.has(postId)) {
        const { error } = await supabase.from("media_likes").delete().eq("user_id", userId).eq("post_id", postId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("media_likes").insert({ user_id: userId, post_id: postId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-likes"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not like"),
  });

  // signed url cache for video posts
  const videoPaths = posts.filter((p) => p.kind === "video" && p.media_path).map((p) => p.media_path as string);
  const { data: signedMap = {} } = useQuery<Record<string, string>>({
    queryKey: ["media-signed", videoPaths.join("|")],
    enabled: videoPaths.length > 0,
    queryFn: async () => {
      const out: Record<string, string> = {};
      await Promise.all(videoPaths.map(async (p) => {
        const { data } = await supabase.storage.from("media-clips").createSignedUrl(p, 60 * 60);
        if (data?.signedUrl) out[p] = data.signedUrl;
      }));
      return out;
    },
  });

  const featured = clips[0];
  const rest = clips.slice(1);

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 lg:pt-10 pb-10">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl font-black tracking-tight">Media</h1>
          <p className="text-sm text-muted-foreground mt-1">Clips, posts, and the weekly featured drop.</p>
        </div>
        <button
          onClick={() => setComposeOpen(true)}
          className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 glow-orange hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New post
        </button>
      </div>

      {/* User posts feed */}
      {isLoading ? (
        <div className="h-24 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : posts.length > 0 && (
        <section className="mb-10">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-3">Fresh from the squad</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {posts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                signedUrl={p.media_path ? signedMap[p.media_path] : undefined}
                liked={myLikes.has(p.id)}
                likeCount={likeCounts.get(p.id) ?? 0}
                onToggleLike={() => toggleLike.mutate(p.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      {featured && (
        <div className="relative rounded-3xl overflow-hidden border border-primary/30 mb-8 aspect-[16/9] sm:aspect-[21/9] group cursor-pointer">
          <img src={featured.thumb} alt={featured.title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground uppercase tracking-wider">
            <Flame className="h-3 w-3" /> Weekly Featured
          </div>
          <button className="absolute inset-0 grid place-items-center" onClick={() => toast(`Playing "${featured.title}"`)}>
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-primary text-primary-foreground grid place-items-center glow-orange group-hover:scale-110 transition-transform">
              <Play className="h-7 w-7 fill-current ml-1" />
            </div>
          </button>
          <div className="absolute bottom-4 left-4 right-4 text-white">
            <p className="font-display text-xl sm:text-2xl font-black">{featured.title}</p>
            <p className="text-sm opacity-80 mt-1">{featured.game} · @{featured.author} · {featured.views} views</p>
          </div>
        </div>
      )}

      {/* Mock community grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {rest.map((c) => {
          const isLiked = likedClips.has(c.id);
          return (
            <div key={c.id} className="group relative rounded-2xl overflow-hidden border border-border bg-card aspect-[3/4] cursor-pointer">
              <img src={c.thumb} alt={c.title} className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
              <div className="absolute top-2 left-2 flex gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur text-white px-2 py-0.5 rounded">{c.game}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded">{c.type}</span>
              </div>
              <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold text-white bg-black/60 backdrop-blur px-2 py-0.5 rounded">
                <Eye className="h-3 w-3" />{c.views}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); if (isLiked) { toast("You already liked this"); return; } likeClip(c.id); }}
                className={cn(
                  "absolute bottom-2 right-2 flex items-center gap-1 text-xs font-bold text-white bg-black/60 backdrop-blur px-2 py-1 rounded-full transition-colors",
                  isLiked ? "bg-primary cursor-default" : "hover:bg-primary"
                )}
              >
                <Flame className={cn("h-3 w-3", isLiked && "fill-current")} /> {c.likes.toLocaleString()}
              </button>
              <div className="absolute bottom-2 left-2 right-16 text-white">
                <p className="text-xs font-bold truncate">{c.title}</p>
                <p className="text-[10px] opacity-70">@{c.author}</p>
              </div>
            </div>
          );
        })}
      </div>

      {userId && (
        <ComposeDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          userId={userId}
          onPosted={() => qc.invalidateQueries({ queryKey: ["media-posts"] })}
        />
      )}
    </div>
  );
}

function PostCard({
  post, signedUrl, liked, likeCount, onToggleLike,
}: {
  post: MediaPost;
  signedUrl?: string;
  liked: boolean;
  likeCount: number;
  onToggleLike: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
      <div className="p-3 flex items-center gap-2 border-b border-border">
        <KindBadge kind={post.kind} />
        {post.title && <p className="text-sm font-bold truncate flex-1">{post.title}</p>}
        {post.tokens_spent > 0 && (
          <span className="text-[10px] font-bold flex items-center gap-1 text-primary">
            <Coins className="h-3 w-3" />{post.tokens_spent}
          </span>
        )}
      </div>

      {post.kind === "video" && (
        <div className="aspect-video bg-black">
          {signedUrl ? (
            <video src={signedUrl} controls className="w-full h-full" preload="metadata" />
          ) : (
            <div className="w-full h-full grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          )}
        </div>
      )}

      {post.kind === "text" && (
        <p className="p-4 text-sm whitespace-pre-line">{post.body}</p>
      )}

      {post.kind === "tweet" && post.source_url && (
        <div className="bg-surface/40">
          <iframe
            src={`https://twitframe.com/show?url=${encodeURIComponent(post.source_url)}`}
            className="w-full"
            style={{ height: 420, border: 0 }}
            title="Tweet embed"
            loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      )}

      <div className="p-3 flex items-center justify-between border-t border-border">
        <div className="text-[10px] text-muted-foreground">
          {post.game && <span className="mr-2">{post.game}</span>}
          {post.duration_s ? <span>{post.duration_s}s</span> : null}
        </div>
        <button
          onClick={onToggleLike}
          className={cn(
            "flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border transition-all",
            liked ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-primary hover:border-primary/40"
          )}
        >
          <Flame className={cn("h-3 w-3", liked && "fill-current")} /> {likeCount}
        </button>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: MediaPost["kind"] }) {
  const map = {
    video: { icon: VideoIcon, label: "Clip" },
    text:  { icon: MessageSquare, label: "Post" },
    tweet: { icon: Link2, label: "Tweet" },
  } as const;
  const { icon: Icon, label } = map[kind];
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}
