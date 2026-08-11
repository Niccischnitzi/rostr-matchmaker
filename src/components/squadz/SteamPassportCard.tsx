// Steam section of the Universal Gaming Passport.
// Renders verified Steam identity (SteamID64, persona, avatar) plus library
// details. Used on your own profile (with a sync button) and on other players'
// public profiles via the public_linked_accounts RPC.
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { syncSteam } from "@/lib/steam.functions";
import { Check, Copy, Loader2, RefreshCw, ExternalLink, Gamepad2 } from "lucide-react";
import { toast } from "sonner";

export type SteamPassportData = {
  steam_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  profile_url?: string | null;
  country?: string | null;
  library_count?: number | null;
  total_hours?: number | null;
  top_games?: Array<{ appid: number; name: string | null; hours: number }> | null;
  synced_at?: string | null;
};

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
  const games = data?.top_games ?? [];

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
        toast.success("Steam synced");
        onSynced?.();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl overflow-hidden grid place-items-center shrink-0" style={{ background: "#171a21" }}>
          {data?.avatar_url ? (
            <img src={data.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <Gamepad2 className="h-5 w-5 text-white" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Steam · verified</p>
          <p className="font-bold truncate">{data?.display_name ?? gamertag}</p>
          {id && <p className="font-mono text-[11px] text-muted-foreground truncate">{id}</p>}
        </div>
        <div className="flex items-center gap-1.5">
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

      {(hours != null || data?.library_count != null) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Hours played" value={hours != null ? `${hours.toLocaleString()}h` : "—"} />
          <Stat label="Games owned" value={data?.library_count != null ? String(data.library_count) : "—"} />
        </div>
      )}

      {games.length > 0 && (
        <div className="mt-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5">Most played</p>
          <ul className="space-y-1">
            {games.map((g) => (
              <li key={g.appid} className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium">{g.name ?? `App ${g.appid}`}</span>
                <span className="font-mono text-muted-foreground shrink-0">{g.hours}h</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {own && !data?.total_hours && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Hit sync to pull your library and playtime from Steam.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface border border-border p-2.5 text-center">
      <p className="font-display text-lg font-black leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
    </div>
  );
}
