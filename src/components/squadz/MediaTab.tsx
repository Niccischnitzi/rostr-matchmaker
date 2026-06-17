import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSquadz } from "@/lib/squadz-store";
import { Play, Flame, Eye, Plus, Coins, Loader2, Video as VideoIcon, MessageSquare, Link2, Bookmark, Repeat2, Heart, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ComposeDialog } from "./ComposeDialog";
import { sfx } from "@/lib/sfx";
import { UserSafetyActions } from "./UserSafetyActions";
import { ReelsView } from "./ReelsView";
import { useVisibleVideo } from "@/hooks/use-visible-video";

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
type Save = { post_id: string; user_id: string };
type Repost = { id: string; post_id: string; user_id: string };
type MediaComment = { id: string; post_id: string; user_id: string; body: string; created_at: string };
type AuthorMini = { id: string; username: string; display_name: string | null; avatar_url: string | null };

export function MediaTab() {
  const qc = useQueryClient();
  const { clips, likeClip, likedClips } = useSquadz();
  const [composeOpen, setComposeOpen] = useState(false);
  const [tab, setTab] = useState<"feed" | "reels" | "saved">("feed");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

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

  const { data: saves = [] } = useQuery<Save[]>({
    queryKey: ["media-saves", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("media_saves" as any).select("post_id, user_id");
      if (error) throw error;
      return (data as any) as Save[];
    },
  });

  const { data: reposts = [] } = useQuery<Repost[]>({
    queryKey: ["media-reposts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("media_reposts" as any).select("id, post_id, user_id");
      if (error) throw error;
      return (data as any) as Repost[];
    },
  });

  const { data: comments = [] } = useQuery<MediaComment[]>({
    queryKey: ["media-comments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("media_comments" as any).select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any) as MediaComment[];
    },
  });

  // Fetch liker mini-profiles
  const likerIds = useMemo(() => Array.from(new Set([...likes.map((l) => l.user_id), ...comments.map((c) => c.user_id)])), [likes, comments]);
  const { data: likers = [] } = useQuery<AuthorMini[]>({
    queryKey: ["likers", likerIds.join(",")],
    enabled: likerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", likerIds);
      return (data ?? []) as AuthorMini[];
    },
  });
  const likerMap = useMemo(() => new Map(likers.map((u) => [u.id, u])), [likers]);

  const likeCounts = useMemo(() => {
    const m = new Map<string, number>();
    likes.forEach((l) => m.set(l.post_id, (m.get(l.post_id) ?? 0) + 1));
    return m;
  }, [likes]);
  const repostCounts = useMemo(() => {
    const m = new Map<string, number>();
    reposts.forEach((r) => m.set(r.post_id, (m.get(r.post_id) ?? 0) + 1));
    return m;
  }, [reposts]);
  const commentsByPost = useMemo(() => {
    const m = new Map<string, MediaComment[]>();
    comments.forEach((c) => {
      const arr = m.get(c.post_id) ?? [];
      arr.push(c);
      m.set(c.post_id, arr);
    });
    return m;
  }, [comments]);

  const myLikes = useMemo(() => new Set(likes.filter((l) => l.user_id === userId).map((l) => l.post_id)), [likes, userId]);
  const mySaves = useMemo(() => new Set(saves.filter((s) => s.user_id === userId).map((s) => s.post_id)), [saves, userId]);
  const myReposts = useMemo(() => new Set(reposts.filter((r) => r.user_id === userId).map((r) => r.post_id)), [reposts, userId]);

  const likersByPost = useMemo(() => {
    const m = new Map<string, AuthorMini[]>();
    likes.forEach((l) => {
      const u = likerMap.get(l.user_id);
      if (!u) return;
      const arr = m.get(l.post_id) ?? [];
      arr.push(u);
      m.set(l.post_id, arr);
    });
    return m;
  }, [likes, likerMap]);

  const toggleLike = useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error("Not signed in");
      if (myLikes.has(postId)) {
        const { error } = await supabase.from("media_likes").delete().eq("user_id", userId).eq("post_id", postId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("media_likes").insert({ user_id: userId, post_id: postId });
        if (error) throw error;
        sfx.like();
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-likes"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not like"),
  });

  const toggleSave = useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error("Not signed in");
      if (mySaves.has(postId)) {
        const { error } = await supabase.from("media_saves" as any).delete().eq("user_id", userId).eq("post_id", postId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("media_saves" as any).insert({ user_id: userId, post_id: postId } as any);
        if (error) throw error;
        sfx.tap();
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-saves", userId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const toggleRepost = useMutation({
    mutationFn: async (postId: string) => {
      if (!userId) throw new Error("Not signed in");
      if (myReposts.has(postId)) {
        const { error } = await supabase.from("media_reposts" as any).delete().eq("user_id", userId).eq("post_id", postId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("media_reposts" as any).insert({ user_id: userId, post_id: postId } as any);
        if (error) throw error;
        sfx.send();
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-reposts"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Repost failed"),
  });

  const deletePost = useMutation({
    mutationFn: async (post: MediaPost) => {
      if (!userId || post.user_id !== userId) throw new Error("You can only delete your own posts");
      const { error } = await supabase.from("media_posts").delete().eq("id", post.id).eq("user_id", userId);
      if (error) throw error;
      if (post.media_path) await supabase.storage.from("media-clips").remove([post.media_path]);
    },
    onSuccess: () => {
      toast.success("Post deleted");
      qc.invalidateQueries({ queryKey: ["media-posts"] });
      qc.invalidateQueries({ queryKey: ["media-comments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const addComment = useMutation({
    mutationFn: async ({ postId, body }: { postId: string; body: string }) => {
      if (!userId) throw new Error("Not signed in");
      const text = body.trim();
      if (!text) throw new Error("Write a comment first");
      const { error } = await supabase.from("media_comments" as any).insert({ post_id: postId, user_id: userId, body: text.slice(0, 280) } as any);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      setCommentDrafts((prev) => ({ ...prev, [vars.postId]: "" }));
      qc.invalidateQueries({ queryKey: ["media-comments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Comment failed"),
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("media_comments" as any).delete().eq("id", commentId).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media-comments"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

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

  const visiblePosts = tab === "saved" ? posts.filter((p) => mySaves.has(p.id)) : posts;
  const featured = clips[0];
  const rest = clips.slice(1);

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6 lg:pt-10 pb-10">
      <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight truncate">Media</h1>
          <p className="hidden sm:block text-sm text-muted-foreground mt-1">Clips, posts, and the weekly featured drop.</p>
        </div>
        <button
          onClick={() => { sfx.tap(); setComposeOpen(true); }}
          className="shrink-0 h-10 px-3 sm:px-4 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 glow-orange hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New post</span><span className="sm:hidden">Post</span>
        </button>
      </div>

      <div className="inline-flex rounded-full bg-surface p-1 border border-border mb-4 sm:mb-5 text-xs sm:text-sm">
        {([["feed", "Feed"], ["reels", "Reels"], ["saved", `Saved (${mySaves.size})`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); sfx.tap(); }}
            className={cn("px-3 sm:px-4 py-1.5 rounded-full font-semibold transition-colors",
              tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
            {l}
          </button>
        ))}
      </div>

      {tab === "reels" ? (
        <div className="-mx-3 sm:-mx-4">
          <ReelsView />
        </div>
      ) : null}


      {tab === "reels" ? null : isLoading ? (
        <div className="h-24 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : visiblePosts.length > 0 ? (
        <section className="mb-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visiblePosts.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                signedUrl={p.media_path ? signedMap[p.media_path] : undefined}
                liked={myLikes.has(p.id)}
                saved={mySaves.has(p.id)}
                reposted={myReposts.has(p.id)}
                likeCount={likeCounts.get(p.id) ?? 0}
                repostCount={repostCounts.get(p.id) ?? 0}
                likers={likersByPost.get(p.id) ?? []}
                comments={commentsByPost.get(p.id) ?? []}
                commenterMap={likerMap}
                currentUserId={userId}
                commentDraft={commentDrafts[p.id] ?? ""}
                onCommentDraft={(value: string) => setCommentDrafts((prev) => ({ ...prev, [p.id]: value }))}
                onToggleLike={() => toggleLike.mutate(p.id)}
                onToggleSave={() => toggleSave.mutate(p.id)}
                onToggleRepost={() => toggleRepost.mutate(p.id)}
                onAddComment={() => addComment.mutate({ postId: p.id, body: commentDrafts[p.id] ?? "" })}
                onDeleteComment={(commentId: string) => deleteComment.mutate(commentId)}
                onDeletePost={() => {
                  if (confirm("Delete this post?")) deletePost.mutate(p);
                }}
              />
            ))}
          </div>
        </section>
      ) : tab === "saved" ? (
        <p className="text-center text-sm text-muted-foreground py-10">No saved posts yet.</p>
      ) : null}

      {tab === "feed" && featured && (
        <div className="relative rounded-3xl overflow-hidden border border-primary/30 mb-8 aspect-[16/9] sm:aspect-[21/9] group cursor-pointer soft-rise">
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

      {tab === "feed" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {rest.map((c) => {
            const isLiked = likedClips.has(c.id);
            return (
              <div key={c.id} className="group relative rounded-2xl overflow-hidden border border-border bg-card aspect-[3/4] cursor-pointer soft-rise">
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
                  onClick={(e) => { e.stopPropagation(); if (isLiked) { toast("You already liked this"); return; } sfx.like(); likeClip(c.id); }}
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
      )}

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
  post, signedUrl, liked, saved, reposted, likeCount, repostCount, likers, comments, commenterMap, currentUserId, commentDraft,
  onCommentDraft, onToggleLike, onToggleSave, onToggleRepost, onAddComment, onDeleteComment, onDeletePost,
}: {
  post: MediaPost;
  signedUrl?: string;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  likeCount: number;
  repostCount: number;
  likers: AuthorMini[];
  comments: MediaComment[];
  commenterMap: Map<string, AuthorMini>;
  currentUserId: string | null | undefined;
  commentDraft: string;
  onCommentDraft: (value: string) => void;
  onToggleLike: () => void;
  onToggleSave: () => void;
  onToggleRepost: () => void;
  onAddComment: () => void;
  onDeleteComment: (commentId: string) => void;
  onDeletePost: () => void;
}) {
  const isOwner = currentUserId === post.user_id;
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden flex flex-col soft-rise">
      <div className="p-3 flex items-center gap-2 border-b border-border">
        <KindBadge kind={post.kind} />
        {post.title && <p className="text-sm font-bold truncate flex-1">{post.title}</p>}
        {post.tokens_spent > 0 && (
          <span className="text-[10px] font-bold flex items-center gap-1 text-primary">
            <Coins className="h-3 w-3" />{post.tokens_spent}
          </span>
        )}
        {isOwner && (
          <button onClick={onDeletePost} title="Delete post" className="h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        {!isOwner && <UserSafetyActions targetId={post.user_id} targetLabel="post author" />}
      </div>

      {post.kind === "video" && (
        <div className="aspect-video bg-black">
          {signedUrl ? (
            <AutoPauseVideo src={signedUrl} />
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

      {likers.length > 0 && (
        <div className="px-3 pt-2 flex items-center gap-2">
          <div className="flex -space-x-2">
            {likers.slice(0, 5).map((u) => (
              <div key={u.id} className="h-5 w-5 rounded-full border-2 border-card bg-surface-2 overflow-hidden" title={u.display_name ?? u.username}>
                {u.avatar_url && <img src={u.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Liked by <span className="font-semibold text-foreground">{likers[0].display_name ?? likers[0].username}</span>
            {likers.length > 1 && ` and ${likers.length - 1} others`}
          </p>
        </div>
      )}

      <div className="p-3 flex items-center justify-between border-t border-border mt-2">
        <div className="flex items-center gap-1">
          <ActionBtn active={liked} onClick={onToggleLike} title="Like">
            <Heart className={cn("h-4 w-4", liked && "fill-current")} />
            <span className="text-xs font-semibold">{likeCount}</span>
          </ActionBtn>
          <ActionBtn active={reposted} onClick={onToggleRepost} title="Repost" tone="success">
            <Repeat2 className="h-4 w-4" />
            <span className="text-xs font-semibold">{repostCount}</span>
          </ActionBtn>
          <ActionBtn active={saved} onClick={onToggleSave} title="Save">
            <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
          </ActionBtn>
          <ActionBtn active={comments.length > 0} onClick={() => document.getElementById(`comment-${post.id}`)?.focus()} title="Comment">
            <MessageSquare className="h-4 w-4" />
            <span className="text-xs font-semibold">{comments.length}</span>
          </ActionBtn>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {post.game && <span className="mr-2">{post.game}</span>}
          {post.duration_s ? <span>{post.duration_s}s</span> : null}
        </div>
      </div>
      <div className="px-3 pb-3 space-y-2">
        {comments.slice(-3).map((comment) => {
          const author = commenterMap.get(comment.user_id);
          return (
            <div key={comment.id} className="flex items-start gap-2 rounded-xl bg-surface/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-muted-foreground truncate">@{author?.username ?? "player"}</p>
                <p className="text-sm break-words">{comment.body}</p>
              </div>
              {comment.user_id === currentUserId && (
                <button onClick={() => onDeleteComment(comment.id)} title="Delete comment" className="h-7 w-7 rounded-full grid place-items-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {currentUserId && (
          <div className="flex items-center gap-2">
            <input
              id={`comment-${post.id}`}
              value={commentDraft}
              onChange={(e) => onCommentDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && commentDraft.trim()) onAddComment(); }}
              placeholder="Add a comment…"
              maxLength={280}
              className="min-w-0 flex-1 bg-surface rounded-full px-3 py-2 text-sm border border-border focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button onClick={onAddComment} disabled={!commentDraft.trim()} className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center disabled:opacity-40">
              <Send className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ active, onClick, title, tone, children }: { active: boolean; onClick: () => void; title: string; tone?: "success"; children: React.ReactNode }) {
  const color = tone === "success" ? "text-success" : "text-primary";
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-full transition-colors",
        active ? `${color} bg-foreground/5` : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
      )}
    >
      {children}
    </button>
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

function AutoPauseVideo({ src }: { src: string }) {
  // Autoplays muted when visible, pauses when scrolled away or tab hidden.
  // Wrapped in error state so a single bad clip never crashes the whole feed.
  const { ref } = useVisibleVideo({ threshold: 0.5, autoplay: true });
  const [errored, setErrored] = useState(false);
  if (errored) {
    return (
      <div className="w-full h-full grid place-items-center text-xs text-muted-foreground bg-surface">
        <div className="text-center px-4">
          <VideoIcon className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p>Clip unavailable</p>
          <button onClick={() => setErrored(false)} className="mt-2 text-primary font-semibold">Retry</button>
        </div>
      </div>
    );
  }
  return (
    <video
      ref={ref}
      src={src}
      controls
      muted
      playsInline
      loop
      preload="metadata"
      className="w-full h-full"
      onError={() => setErrored(true)}
      onStalled={(e) => {
        // Don't crash on transient network stalls — just keep showing the poster.
        e.preventDefault();
      }}
    />
  );
}

