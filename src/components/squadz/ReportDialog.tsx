// Sprint 2 — universal Report dialog.
// Captures structured reason + free-text details + optional proof upload,
// inserts into user_reports, and (once email infra is live) the admin
// alert is enqueued by the submitReport server function.
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Upload, ShieldAlert } from "lucide-react";

export type ReportTargetType =
  | "profile"
  | "media_post"
  | "direct_message"
  | "crew"
  | "comment"
  | "club"
  | "club_message"
  | "voice_snippet";

const REASONS = [
  { key: "cheating", label: "Cheating / hacking" },
  { key: "harassment", label: "Harassment or bullying" },
  { key: "hate", label: "Hate speech" },
  { key: "sexual", label: "Sexual content" },
  { key: "underage", label: "Underage user" },
  { key: "spam", label: "Spam or scam" },
  { key: "other", label: "Something else" },
] as const;

export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
}) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setReason(""); setDetails(""); setProof(null);
  }

  async function submit() {
    if (busy) return;
    if (!reason) { toast.error("Pick a reason"); return; }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) { toast.error("Sign in to report"); return; }

      let proofUrl: string | null = null;
      if (proof) {
        if (proof.size > 10 * 1024 * 1024) {
          toast.error("Proof file must be under 10 MB"); return;
        }
        const path = `${uid}/reports/${Date.now()}-${proof.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("dm-attachments")
          .upload(path, proof, { contentType: proof.type || "application/octet-stream" });
        if (upErr) throw upErr;
        proofUrl = path;
      }

      const context = {
        route: typeof window !== "undefined" ? window.location.pathname : null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        target_label: targetLabel ?? null,
        app: "rostr-web",
      };

      const { error } = await supabase.from("user_reports" as any).insert({
        reporter_id: uid,
        target_type: targetType,
        target_id: targetId,
        reason: REASONS.find((r) => r.key === reason)?.label ?? reason,
        details: details.trim().slice(0, 1000) || null,
        proof_url: proofUrl,
        context,
      } as any);
      if (error) throw error;

      toast.success("Thanks — our moderators have been notified.");
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl font-black">
            <ShieldAlert className="h-5 w-5 text-primary" /> Report
          </DialogTitle>
          <DialogDescription>
            {targetLabel ? `Reporting "${targetLabel}". ` : ""}Reports are reviewed by the rostr team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Reason</p>
          <div className="grid grid-cols-2 gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r.key}
                onClick={() => setReason(r.key)}
                className={cn(
                  "px-3 py-2 rounded-xl border-2 text-xs font-bold text-left transition-all",
                  reason === r.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/60"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>

          <Textarea
            placeholder="Add any details that help us understand (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            className="min-h-[90px]"
          />
          <p className="text-[10px] text-muted-foreground text-right">{details.length}/1000</p>

          <label className="block">
            <input
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
            />
            <div className={cn(
              "rounded-xl border-2 border-dashed px-3 py-3 text-xs flex items-center gap-2 cursor-pointer hover:border-primary/60 transition",
              proof ? "border-primary/60 text-foreground" : "border-border text-muted-foreground"
            )}>
              <Upload className="h-4 w-4" />
              {proof ? (
                <span className="font-semibold truncate">{proof.name} · {(proof.size / 1024 / 1024).toFixed(1)} MB</span>
              ) : (
                <span>Attach screenshot or clip (optional, ≤10 MB)</span>
              )}
            </div>
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={busy || !reason}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit report"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
