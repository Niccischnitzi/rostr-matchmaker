// Sprint 5 — owner-only club appearance editor.
// Scopes the chosen accent to the club view only (it does NOT touch
// the user's global theme; the scoping happens in ClubsTab via inline
// `style={{ "--primary": club.accent }}`).
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Palette, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PRESET_ACCENTS = [
  "#ff5722", "#8b5cf6", "#22d3ee", "#a3e635",
  "#f43f5e", "#f59e0b", "#10b981", "#6366f1",
];

export function ClubAppearance({
  open,
  onOpenChange,
  clubId,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clubId: string;
  initial: { accent: string | null; banner_url: string | null; tagline: string | null };
  onSaved: (next: { accent: string | null; banner_url: string | null; tagline: string | null }) => void;
}) {
  const [accent, setAccent] = useState<string>(initial.accent ?? "#ff5722");
  const [tagline, setTagline] = useState<string>(initial.tagline ?? "");
  const [bannerUrl, setBannerUrl] = useState<string | null>(initial.banner_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  async function pickBanner(file: File) {
    if (!file.type.startsWith("image/")) { toast.error("Pick an image"); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("Banner must be under 4 MB"); return; }
    setUploading(true);
    try {
      const path = `clubs/${clubId}/banner-${Date.now()}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setBannerUrl(data.publicUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!/^#[0-9a-f]{6}$/i.test(accent)) { toast.error("Accent must be a hex color"); return; }
    setBusy(true);
    const patch = {
      accent,
      tagline: tagline.trim().slice(0, 120) || null,
      banner_url: bannerUrl,
    };
    const { error } = await supabase.from("clubs").update(patch as any).eq("id", clubId);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Club appearance saved");
    onSaved(patch);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl font-black">
            <Palette className="h-5 w-5 text-primary" /> Club appearance
          </DialogTitle>
          <DialogDescription>Owner controls. These change how this club looks for everyone.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Accent</p>
            <div className="flex flex-wrap gap-2">
              {PRESET_ACCENTS.map((c) => (
                <button
                  key={c}
                  onClick={() => setAccent(c)}
                  className={cn("h-9 w-9 rounded-xl border-2 transition-transform",
                    accent.toLowerCase() === c ? "border-foreground scale-110" : "border-border hover:scale-105")}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
              <Input
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="h-9 w-28 font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Tagline</p>
            <Textarea
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={120}
              placeholder="Late-night squad, ranked grinders, EU only…"
              className="min-h-[60px]"
            />
            <p className="text-[10px] text-muted-foreground text-right">{tagline.length}/120</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Banner</p>
            <label className="block">
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) pickBanner(f); }} />
              <div
                className="relative h-28 rounded-xl border-2 border-dashed border-border overflow-hidden cursor-pointer hover:border-primary/60 transition"
                style={bannerUrl ? { backgroundImage: `url(${bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
              >
                <div className="absolute inset-0 grid place-items-center bg-black/30 text-white text-xs font-semibold">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <span className="flex items-center gap-1"><Upload className="h-3.5 w-3.5" /> {bannerUrl ? "Replace banner" : "Upload banner"}</span>
                  )}
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={busy || uploading}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
