import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Video, Type, Link2, Coins, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { uploadCost, fetchUploadsToday, probeVideo, FREE_RESOLUTION_HEIGHT, PRO_RESOLUTION_HEIGHT } from "@/lib/uploadPricing";
import { useSubscription } from "@/hooks/use-subscription";

// Free limits
const FREE_SECS = 15;
const FREE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_SECS = 300;                 // hard cap 5 min
const MAX_BYTES = 250 * 1024 * 1024;  // hard cap 250 MB

// Legacy helper retained for callers that don't use the exponential model.
export function tokensForDuration(seconds: number) {
  if (seconds <= FREE_SECS) return 0;
  return Math.ceil((seconds - FREE_SECS) / 10) * 10;
}

type Kind = "video" | "text" | "tweet";

export function ComposeDialog({
  open, onOpenChange, userId, onPosted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  onPosted?: () => void;
}) {
  const [kind, setKind] = useState<Kind>("video");
  const [title, setTitle] = useState("");
  const [game, setGame] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [duration, setDuration] = useState<number>(0);
  const [resHeight, setResHeight] = useState<number>(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { isPro } = useSubscription();
  const resCap = isPro ? PRO_RESOLUTION_HEIGHT : FREE_RESOLUTION_HEIGHT;

  // Wallet balance for token math
  const { data: balance = 0 } = useQuery({
    queryKey: ["wallet-balance", userId],
    enabled: !!userId && open,
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("balance_points").eq("user_id", userId).maybeSingle();
      return data?.balance_points ?? 0;
    },
  });

  // Exponential daily upload count → cost = 5 * 2^n (capped 320).
  const { data: uploadsToday = 0 } = useQuery({
    queryKey: ["media-uploads-today", userId],
    enabled: !!userId && open,
    queryFn: () => fetchUploadsToday(userId),
  });

  useEffect(() => {
    if (!open) {
      setKind("video"); setTitle(""); setGame(""); setBody(""); setUrl(""); setFile(null); setDuration(0); setResHeight(0);
    }
  }, [open]);

  const tokensNeeded = file ? uploadCost(uploadsToday) : 0;
  const overSizeFree = !!file && file.size > FREE_BYTES;
  const canPay = balance >= tokensNeeded;
  const tooBig = !!file && file.size > MAX_BYTES;
  const tooLong = !!file && duration > MAX_SECS;
  const overRes = !!file && resHeight > 0 && resHeight > resCap;

  const pickFile = async (f: File) => {
    setFile(f);
    setDuration(0);
    setResHeight(0);
    try {
      const meta = await probeVideo(f);
      setDuration(meta.duration);
      setResHeight(meta.height);
    } catch {
      toast.error("Could not read video metadata");
    }
  };

  const submit = async () => {
    if (busy) return;
    try {
      setBusy(true);

      if (kind === "video") {
        if (!file) { toast.error("Pick a video file"); return; }
        if (tooBig || tooLong) { toast.error("File exceeds 5 min / 250 MB hard cap"); return; }
        if (overRes) { toast.error(`Resolution capped at ${resCap}p${isPro ? "" : " — upgrade to Pro for 1080p"}`); return; }
        if (tokensNeeded > 0 && !canPay) {
          toast.error(`Needs ${tokensNeeded} tokens — you have ${balance}`);
          return;
        }
        if (tokensNeeded > 0) {
          const { error: spendErr } = await supabase.rpc("spend_tokens", { _amount: tokensNeeded });
          if (spendErr) throw spendErr;
        }
        const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("media-clips").upload(path, file, {
          contentType: file.type || "video/mp4",
        });
        if (upErr) throw upErr;
        const { error: insErr } = await supabase.from("media_posts").insert({
          user_id: userId, kind: "video", title: title.trim() || file.name, game: game.trim() || null,
          media_path: path, duration_s: duration, size_bytes: file.size, tokens_spent: tokensNeeded,
        });
        if (insErr) throw insErr;
      } else if (kind === "text") {
        if (!title.trim()) { toast.error("Subject is required"); return; }
        if (!body.trim()) { toast.error("Write something"); return; }
        const { error } = await supabase.from("media_posts").insert({
          user_id: userId, kind: "text", title: title.trim().slice(0, 80), body: body.trim().slice(0, 280),
        });
        if (error) throw error;
      } else {
        if (!title.trim()) { toast.error("Subject is required"); return; }
        if (!/^https?:\/\/(twitter|x)\.com\//.test(url.trim())) {
          toast.error("Paste a valid X/Twitter URL"); return;
        }
        const { error } = await supabase.from("media_posts").insert({
          user_id: userId, kind: "tweet", source_url: url.trim(), title: title.trim().slice(0, 80),
        });
        if (error) throw error;
      }


      toast.success("Posted!");
      onPosted?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-black">New post</DialogTitle>
          <DialogDescription>Share a clip, drop a thought, or paste an X link.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <KindBtn active={kind === "video"} onClick={() => setKind("video")} icon={Video} label="Video" />
          <KindBtn active={kind === "text"} onClick={() => setKind("text")} icon={Type} label="Text" />
          <KindBtn active={kind === "tweet"} onClick={() => setKind("tweet")} icon={Link2} label="Tweet" />
        </div>

        {kind === "video" && (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); e.target.value = ""; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className={cn(
                "w-full h-32 rounded-2xl border-2 border-dashed border-border bg-surface/40 hover:bg-surface grid place-items-center transition",
                file && "border-primary/60"
              )}
            >
              {file ? (
                <div className="text-center">
                  <p className="font-bold text-sm truncate max-w-xs">{file.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(file.size / 1024 / 1024).toFixed(1)} MB · {duration || "?"}s{resHeight ? ` · ${resHeight}p` : ""}
                  </p>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Upload className="h-6 w-6 mx-auto" />
                  <p className="text-sm font-semibold mt-1">Choose video</p>
                  <p className="text-[10px]">MP4 / WebM / MOV · {resCap}p max{isPro ? "" : " (Pro: 1080p)"}</p>
                </div>
              )}
            </button>
            <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
            <Input placeholder="Game (optional)" value={game} onChange={(e) => setGame(e.target.value)} maxLength={40} />
            {file && (
              <div className={cn(
                "rounded-xl border p-3 text-xs",
                tokensNeeded === 0 ? "border-success/40 bg-success/5" : "border-primary/40 bg-primary/5"
              )}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Coins className="h-3.5 w-3.5 text-primary" />
                    {tokensNeeded === 0 ? "Free upload" : `${tokensNeeded} tokens`}
                  </span>
                  <span className="text-muted-foreground">Balance: {balance}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Daily cost doubles per upload (5 → 10 → 20 …), capped at 320. You've posted {uploadsToday} today.
                </p>
                {overRes && (
                  <p className="mt-1 text-destructive">
                    {resHeight}p exceeds your {resCap}p cap.{isPro ? "" : " Upgrade to Pro for 1080p."}
                  </p>
                )}
                {overSizeFree && (
                  <p className="mt-1 text-muted-foreground">Over 25 MB.</p>
                )}
                {tooBig && <p className="mt-1 text-destructive">Over 250 MB hard cap.</p>}
                {tooLong && <p className="mt-1 text-destructive">Over 5 min hard cap.</p>}
                {tokensNeeded > 0 && !canPay && (
                  <p className="mt-1 text-destructive">Not enough tokens — earn more by winning challenges.</p>
                )}
              </div>
            )}
          </div>
        )}

        {kind === "text" && (
          <div className="space-y-2">
            <Input
              placeholder="Subject (required)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
            <Textarea
              placeholder="What's on your mind, gamer?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={280}
              className="min-h-[120px]"
            />
            <p className="text-[10px] text-muted-foreground text-right">{body.length}/280</p>
          </div>
        )}

        {kind === "tweet" && (
          <div className="space-y-2">
            <Input
              placeholder="Subject (required)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
            <Input
              placeholder="https://x.com/username/status/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <p className="text-[10px] text-muted-foreground">We'll embed the tweet in your feed.</p>
          </div>
        )}


        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function KindBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Video; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-all",
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
