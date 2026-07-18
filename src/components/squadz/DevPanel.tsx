import { useEffect, useState } from "react";
import { Wrench, Coins, ShieldCheck, RefreshCcw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-role";
import { useWallet } from "@/hooks/use-wallet";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProfileRow = { id: string; username: string; display_name: string | null; avatar_url: string | null };

/** Floating dev toolbar for admin/dev accounts. Grants tokens, resets, quick lookups. */
export function DevPanel() {
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const { refresh } = useWallet();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("500");
  const [target, setTarget] = useState<ProfileRow | null>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !q.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8);
      setResults((data ?? []) as ProfileRow[]);
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!isAdmin || !user) return null;

  async function grant(delta: number) {
    const uid = target?.id ?? user!.id;
    setBusy(true);
    const { data, error } = await supabase.rpc("admin_adjust_tokens", {
      _target_user: uid,
      _delta: delta,
      _reason: "dev_grant",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${delta > 0 ? "+" : ""}${delta} Shards → ${target?.username ?? "you"}. New balance: ${data}`);
    if (uid === user!.id) refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-28 right-4 z-40 h-11 w-11 rounded-full grid place-items-center shadow-lg border-2",
          "bg-gradient-to-br from-primary to-accent text-primary-foreground border-primary/40",
          "hover:scale-110 active:scale-95 transition-transform pixel-glow",
        )}
        aria-label="Dev tools"
        title="Dev panel"
      >
        <Wrench className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed bottom-44 right-4 z-40 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-primary/40 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-fade-in">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-gradient-to-r from-primary/10 to-accent/10">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold">Dev Panel</p>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold uppercase tracking-wider">
              Admin
            </span>
            <button onClick={() => setOpen(false)} className="h-7 w-7 grid place-items-center hover:bg-surface rounded-md">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Target user</p>
              <div className="space-y-2">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search username… (blank = yourself)"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {results.length > 0 && (
                  <div className="rounded-lg border border-border max-h-40 overflow-y-auto">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setTarget(r); setQ(""); setResults([]); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface text-sm"
                      >
                        {r.avatar_url && <img src={r.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />}
                        <span className="truncate">{r.display_name ?? r.username}</span>
                        <span className="text-muted-foreground text-xs ml-auto">@{r.username}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="text-xs px-3 py-2 rounded-lg bg-surface/60 border border-border">
                  {target ? (
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">→ {target.display_name ?? target.username}</span>
                      <button onClick={() => setTarget(null)} className="text-muted-foreground hover:text-foreground">clear</button>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">→ Yourself</span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Adjust Shards</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-24 bg-surface border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <Button size="sm" disabled={busy} onClick={() => grant(Math.abs(Number(amount) || 0))} className="gap-1.5 flex-1">
                  <Coins className="h-4 w-4" /> Grant
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => grant(-Math.abs(Number(amount) || 0))}>
                  Deduct
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1">
                {[100, 500, 1000, 5000].map((n) => (
                  <button
                    key={n}
                    onClick={() => setAmount(String(n))}
                    className="text-xs py-1.5 rounded-md bg-surface border border-border hover:border-primary"
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={refresh}>
                <RefreshCcw className="h-3.5 w-3.5" /> Refresh wallet
              </Button>
            </div>

            <p className="text-[10px] text-muted-foreground border-t border-border pt-3">
              All actions are logged in <code>token_transactions</code>. Admin-only.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
