import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Zap, Users, Film, Shield, Flame, Share2, Volume2, Star, Flag } from "lucide-react";
import { CosmeticAvatar } from "@/components/cosmetics/CosmeticAvatar";
import { ReportDialog } from "@/components/squadz/ReportDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type PublicProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  country: string | null;
  playstyle_badges: string[] | null;
  availability_status: string | null;
  current_game_activity: string | null;
  lfg_title: string | null;
  lfg_body: string | null;
  lfg_games: string[] | null;
  rep_score: number | null;
  created_at: string;
  halo_class: string | null;
  frame_class: string | null;
};

type Stats = { friend_count: number; clip_count: number; crew_count: number };
type RatingSummary = { avg_score: number; rating_count: number; top_tags: string[] };
type VoiceSnippet = { user_id: string; storage_path: string; duration_seconds: number; transcript: string | null; is_public: boolean };

const SITE = "https://rostr-matchmaker.lovable.app";

export const Route = createFileRoute("/u/$handle")({
  loader: async ({ params }) => {
    const { data: profile } = await supabase.rpc("public_profile" as any, { _username: params.handle });
    const p = (Array.isArray(profile) ? profile[0] : profile) as PublicProfile | null;
    if (!p) throw notFound();
    const { data: statsRes } = await supabase.rpc("public_profile_stats" as any, { _user_id: p.id });
    const s = (Array.isArray(statsRes) ? statsRes[0] : statsRes) as Stats | null;
    const { data: ratingRes } = await supabase.rpc("profile_rating_summary" as any, { _user_id: p.id });
    const rating = (Array.isArray(ratingRes) ? ratingRes[0] : ratingRes) as RatingSummary | null;
    return { profile: p, stats: s ?? { friend_count: 0, clip_count: 0, crew_count: 0 }, rating: rating ?? { avg_score: 0, rating_count: 0, top_tags: [] } };
  },
  head: ({ params, loaderData }) => {
    const d = loaderData?.profile;
    const title = d ? `${d.display_name ?? d.username} (@${d.username}) — Rostr` : `@${params.handle} — Rostr`;
    const desc = d?.bio?.slice(0, 155) ?? `Player profile for @${params.handle} on Rostr — the gaming social hub.`;
    const url = `${SITE}/u/${params.handle}`;
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "profile" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (d?.banner_url) {
      meta.push({ property: "og:image", content: d.banner_url });
      meta.push({ name: "twitter:image", content: d.banner_url });
    } else if (d?.avatar_url) {
      meta.push({ property: "og:image", content: d.avatar_url });
    }
    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts: d
        ? [{
            type: "application/ld+json",
            children: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ProfilePage",
              mainEntity: {
                "@type": "Person",
                name: d.display_name ?? d.username,
                alternateName: d.username,
                description: desc,
                image: d.avatar_url ?? undefined,
                url,
              },
            }),
          }]
        : undefined,
    };
  },
  errorComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <p className="font-display text-2xl font-black">Profile unavailable</p>
        <p className="text-sm text-muted-foreground mt-1">This page couldn't be loaded.</p>
        <Link to="/" className="mt-4 inline-block rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm">Go home</Link>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <p className="font-display text-3xl font-black">404 · No such rostr</p>
        <p className="text-sm text-muted-foreground mt-1">That handle doesn't exist or is private.</p>
        <Link to="/" className="mt-4 inline-block rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm">Go home</Link>
      </div>
    </div>
  ),
  component: UserProfilePage,
});

function UserProfilePage() {
  const { profile: p, stats, rating } = Route.useLoaderData();
  const initial = (p.display_name ?? p.username).slice(0, 1).toUpperCase();
  const [snippet, setSnippet] = useState<VoiceSnippet | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("voice_snippets" as any)
        .select("user_id, storage_path, duration_seconds, transcript, is_public")
        .eq("user_id", p.id)
        .eq("is_public", true)
        .maybeSingle();
      if (cancelled || !data) return;
      const row = data as VoiceSnippet;
      setSnippet(row);
      const signed = await supabase.storage.from("media-clips").createSignedUrl(row.storage_path, 60 * 10);
      if (!cancelled) setVoiceUrl(signed.data?.signedUrl ?? null);
    })();
    return () => { cancelled = true; };
  }, [p.id]);

  const share = async () => {
    const url = `${SITE}/u/${p.username}`;
    try {
      if (navigator.share) await navigator.share({ title: `@${p.username} on Rostr`, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* HUD top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <Link to="/" className="h-9 w-9 grid place-items-center rounded-lg bg-surface hover:bg-surface-2">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-black">Operator dossier</p>
            <p className="text-xs text-muted-foreground truncate font-mono">/u/{p.username}</p>
          </div>
          <button
            onClick={share}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider hover:opacity-90"
          >
            <Share2 className="h-3.5 w-3.5" />
            Share
          </button>
        </div>
      </header>

      {/* Banner */}
      <div className="relative">
        <div
          className="h-40 sm:h-56 w-full bg-gradient-to-br from-primary/40 via-primary/10 to-background bg-cover bg-center"
          style={p.banner_url ? { backgroundImage: `url(${p.banner_url})` } : undefined}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent pointer-events-none" />
        {/* Angular HUD frame */}
        <div className="pointer-events-none absolute inset-0 border-y border-primary/40 [clip-path:polygon(0_0,100%_0,100%_100%,4%_100%,0_calc(100%-16px))]" />
      </div>

      <main className="max-w-5xl mx-auto px-4 -mt-14 sm:-mt-20 pb-16 relative">
        {/* Identity block */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
          <CosmeticAvatar
            size={128}
            haloClass={p.halo_class ?? undefined}
            frameClass={p.frame_class ?? undefined}
            className="ring-4 ring-background"
          >
            {p.avatar_url ? (
              <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full grid place-items-center bg-gradient-to-br from-primary/60 to-primary/20 font-display text-4xl font-black">
                {initial}
              </div>
            )}
          </CosmeticAvatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight truncate">
                {p.display_name ?? p.username}
              </h1>
              {p.availability_status && (
                <StatusPill status={p.availability_status} />
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono">@{p.username}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {p.country && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {p.country}
                </span>
              )}
              {p.current_game_activity && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Zap className="h-3 w-3" /> {p.current_game_activity}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Flame className="h-3 w-3" /> REP {p.rep_score ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* XP / rep bar */}
        <div className="mt-6 rounded-xl border border-primary/30 bg-surface/40 p-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
            <span>Reputation</span>
            <span className="text-primary">{p.rep_score ?? 0} / 1000</span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
              style={{ width: `${Math.min(100, ((p.rep_score ?? 0) / 1000) * 100)}%` }}
            />
          </div>
        </div>

        {/* Stat panels */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          <StatPanel icon={Users} label="Rostr" value={stats.friend_count} />
          <StatPanel icon={Film} label="Clips" value={stats.clip_count} />
          <StatPanel icon={Shield} label="Crews" value={stats.crew_count} />
        </div>

        <div className="mt-4 grid sm:grid-cols-[1fr_1fr] gap-3">
          <div className="rounded-xl border border-border bg-surface/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Chemistry score</p>
              <Star className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 font-display text-3xl font-black">{Number(rating.avg_score ?? 0).toFixed(1)}<span className="text-sm text-muted-foreground"> / 5</span></p>
            <p className="text-xs text-muted-foreground">{rating.rating_count} teammate rating{rating.rating_count === 1 ? "" : "s"}</p>
            {rating.top_tags?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {rating.top_tags.map((tag) => <span key={tag} className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{tag}</span>)}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-border bg-surface/40 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Voice intro</p>
              {snippet && <span className="text-[10px] uppercase tracking-widest font-black text-primary">{Number(snippet.duration_seconds).toFixed(0)}s</span>}
            </div>
            {voiceUrl ? (
              <>
                <audio controls src={voiceUrl} className="mt-3 w-full h-9" preload="metadata" />
                {snippet?.transcript && <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5"><Volume2 className="h-3 w-3" /> {snippet.transcript}</p>}
                <button onClick={() => setReportOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-destructive">
                  <Flag className="h-3 w-3" /> Report voice
                </button>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No voice intro yet.</p>
            )}
          </div>
        </div>

        {/* Bio */}
        {p.bio && (
          <Section title="Bio">
            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">{p.bio}</p>
          </Section>
        )}

        {/* Playstyle */}
        {p.playstyle_badges && p.playstyle_badges.length > 0 && (
          <Section title="Playstyle">
            <div className="flex flex-wrap gap-1.5">
              {(p.playstyle_badges as string[]).map((b: string) => (
                <span
                  key={b}
                  className="text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-full border border-primary/40 text-primary bg-primary/10"

                >
                  {b}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Current LFG */}
        {(p.lfg_title || p.lfg_body) && (
          <Section title="Current Mission">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
              {p.lfg_title && <p className="font-display text-lg font-bold">{p.lfg_title}</p>}
              {p.lfg_body && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{p.lfg_body}</p>}
              {p.lfg_games && p.lfg_games.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(p.lfg_games as string[]).map((g: string) => (
                    <span key={g} className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-surface text-muted-foreground">
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Section>
        )}

        <p className="mt-10 text-[10px] uppercase tracking-widest text-muted-foreground/70 text-center">
          Joined {new Date(p.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </p>
      </main>
      <ReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        targetType="voice_snippet"
        targetId={p.id}
        targetLabel={`${p.display_name ?? p.username}'s voice intro`}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-black mb-2">{title}</h2>
      {children}
    </section>
  );
}

function StatPanel({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="relative rounded-xl border border-border bg-surface/40 p-3 sm:p-4 overflow-hidden">
      <div className="absolute -top-4 -right-4 h-14 w-14 rounded-full bg-primary/10 blur-2xl" aria-hidden />
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-2 font-display text-2xl sm:text-3xl font-black tabular-nums">{value.toLocaleString()}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    online: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    ingame: "bg-primary/15 text-primary border-primary/40",
    lfg: "bg-sky-500/15 text-sky-400 border-sky-500/40",
    busy: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    offline: "bg-muted/30 text-muted-foreground border-border",
  };
  const key = status.toLowerCase();
  return (
    <span className={cn("text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border", map[key] ?? map.offline)}>
      {status}
    </span>
  );
}
