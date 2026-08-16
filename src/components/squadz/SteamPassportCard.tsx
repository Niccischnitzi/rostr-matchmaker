// Steam section of the Universal Gaming Passport.
// Renders verified Steam identity (SteamID64, persona, avatar) plus library
// details. Used on your own profile (with a sync button) and on other players'
// public profiles via the public_linked_accounts RPC.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { syncSteam } from "@/lib/steam.functions";
import { Check, Copy, Loader2, RefreshCw, ExternalLink, Gamepad2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type SteamPassportData = {
  steam_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  profile_url?: string | null;
  country?: string | null;
  created_at?: string | null;
  library_count?: number | null;
  played_count?: number | null;
  total_hours?: number | null;
  recent_hours?: number | null;
  level?: number | null;
  top_games?: Array<{ appid: number; name: string | null; hours: number; hours_2w?: number }> | null;
  recent_games?: Array<{ appid: number; name: string | null; hours_2w: number }> | null;
  synced_at?: string | null;
};

function relTime(iso: string | null | undefined) {
  if (!iso) return null;
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (!isFinite(mins)) return null;
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function accountAge(iso: string | null | undefined) {
  if (!iso) return null;
  const years = (Date.now() - new Date(iso).getTime()) / (365.25 * 24 * 3600_000);
  if (!isFinite(years) || years <= 0) return null;
  return years < 1 ? `${Math.round(years * 12)}mo` : `${years.toFixed(1)}y`;
}

export function SteamPassportCard({
  gamertag,
  steamId,
  data,
  own = false,
  onSynced,
}: {
  gamertag: string;
  steamId: string | null;
  data: SteamPassportData | null;
  own?: boolean;
  onSynced?: () => void;
}) {
  const sync = useServerFn(syncSteam);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const id = data?.steam_id ?? steamId ?? null;
  const hours = data?.total_hours ?? null;
  const games = (data?.top_games ?? []).filter((g) => g.hours > 0);
  const maxHours = games.reduce((a, g) => Math.max(a, g.hours), 0) || 1;
  const recent = (data?.recent_games ?? []).filter((g) => g.hours_2w > 0);
  const playedPct =
    data?.library_count && data.played_count != null && data.library_count > 0
      ? Math.round((data.played_count / data.library_count) * 100)
      : null;
  const synced = relTime(data?.synced_at);
  const age = accountAge(data?.created_at);

  const copyId = async () => {
    if (!id) return;
    await navigator.clipboard.writeText(id);
    setCopied(true);
    toast.success("SteamID64 copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const doSync = async () => {
    setBusy(true);
    try {
      const res: any = await sync({});
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Steam synced", {
          description: res?.passport
            ? `${res.passport.library_count} games · ${res.passport.total_hours?.toLocaleString?.() ?? res.passport.total_hours}h tracked`
            : undefined,
        });
        onSynced?.();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Identity row */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <div className="h-12 w-12 rounded-xl overflow-hidden grid place-items-center shrink-0 bg-surface-2">
          {data?.avatar_url ? (
            <img src={data.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Gamepad2 className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Steam
            <ShieldCheck className="h-3 w-3 text-success" />
            verified
          </p>
          <p className="font-bold truncate">{data?.display_name ?? gamertag}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {id && <span className="font-mono truncate">{id}</span>}
            {data?.country && <span className="shrink-0">· {data.country}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {id && (
            <button
              onClick={copyId}
              aria-label="Copy SteamID64"
              className="h-9 w-9 rounded-lg bg-surface hover:bg-surface-2 grid place-items-center transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
          )}
          {data?.profile_url && (
            <a
              href={data.profile_url}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Open Steam profile"
              className="h-9 w-9 rounded-lg bg-surface hover:bg-surface-2 grid place-items-center transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
          {own && (
            <button
              onClick={doSync}
              disabled={busy}
              aria-label="Sync Steam"
              className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stat grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Hours" value={hours != null ? `${hours.toLocaleString()}h` : "—"} accent />
          <Stat label="Games" value={data?.library_count != null ? String(data.library_count) : "—"} />
          <Stat label="Last 2 weeks" value={data?.recent_hours != null ? `${data.recent_hours}h` : "—"} />
          <Stat label="Level" value={data?.level != null ? String(data.level) : age ? age : "—"} sub={data?.level != null && age ? `${age} on Steam` : undefined} />
        </div>

        {playedPct != null && (
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              <span>Library played</span>
              <span className="font-mono">{data?.played_count}/{data?.library_count} · {playedPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${playedPct}%` }} />
            </div>
          </div>
        )}

        {games.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Most played</p>
            <ul className="space-y-2">
              {games.map((g) => (
                <li key={g.appid}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-medium">{g.name ?? `App ${g.appid}`}</span>
                    <span className="font-mono text-muted-foreground shrink-0">
                      {g.hours.toLocaleString()}h
                      {g.hours_2w ? <span className="text-primary"> +{g.hours_2w}h</span> : null}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", g.hours_2w ? "bg-primary" : "bg-muted-foreground/40")}
                      style={{ width: `${Math.max(4, (g.hours / maxHours) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {recent.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Playing lately</p>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((g) => (
                <span
                  key={g.appid}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold"
                >
                  {g.name ?? `App ${g.appid}`}
                  <span className="font-mono opacity-80">{g.hours_2w}h</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{synced ? `Synced ${synced}` : own ? "Not synced yet" : "Awaiting sync"}</span>
          {own && hours == null && <span>Hit sync to pull your library.</span>}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-2.5 text-center", accent ? "border-primary/40 bg-primary/5" : "border-border bg-surface")}>
      <p className={cn("font-display text-lg font-black leading-none", accent && "text-primary")}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 truncate">{label}</p>
      {sub && <p className="text-[9px] text-muted-foreground/80 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}
