import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { sfx } from "@/lib/sfx";

export function LfgAdSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [games, setGames] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !user) return;
    setLoading(true);
    supabase.from("profiles" as any).select("is_public, lfg_title, lfg_body, lfg_games").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        const d = data as any;
        setIsPublic(d?.is_public ?? true);
        setTitle(d?.lfg_title ?? "");
        setBody(d?.lfg_body ?? "");
        setGames(Array.isArray(d?.lfg_games) ? d.lfg_games.join(", ") : "");
        setLoading(false);
      });
  }, [open, user]);

  async function save() {
    if (!user) return;
    setBusy(true);
    const payload = {
      is_public: isPublic,
      lfg_title: title.trim() || null,
      lfg_body: body.trim() || null,
      lfg_games: games.split(",").map((g) => g.trim()).filter(Boolean),
    };
    const { error } = await supabase.from("profiles" as any).update(payload).eq("id", user.id);
    setBusy(false);
    if (error) { sfx.error?.(); return toast.error(error.message); }
    sfx.win();
    toast.success("Your ad is live!");
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Megaphone className="h-4 w-4" /> Your LFG ad</SheetTitle>
          <SheetDescription>Tell players what you're looking for. Visible when your profile is public.</SheetDescription>
        </SheetHeader>
        {loading ? (
          <div className="grid place-items-center h-40"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="mt-6 space-y-4 px-4 pb-6">
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
              <div>
                <p className="text-sm font-bold">Public profile</p>
                <p className="text-[11px] text-muted-foreground">Show your ad on the Find page.</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Headline</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Looking for chill duo partner" maxLength={80} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Details</label>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Evenings EU, no mic OK, focus ranked." maxLength={280} className="min-h-[100px]" />
              <p className="text-[10px] text-muted-foreground text-right mt-1">{body.length}/280</p>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Games (comma separated)</label>
              <Input value={games} onChange={(e) => setGames(e.target.value)} placeholder="Valorant, Apex, CS2" maxLength={120} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button className="flex-1" onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save ad"}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
