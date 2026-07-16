import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACCENTS, FONT_FAMILIES, PALETTES, HOVER_HUES, applyPalettePreset,
  loadCustomization, saveCustomization, previewCustomization, applyCustomization,
  type AccentKey, type DensityKey, type FontKey, type AnimKey, type PaletteKey, type HoverHueKey,
  DEFAULT_CUSTOMIZATION, type Customization,
} from "@/lib/customization";

import { Slider } from "@/components/ui/slider";
import { Sparkles, Palette, Type, Gauge, Wand2, RotateCcw, Check, Undo2, Layers, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// Premium cosmetics — cost tokens to unlock once, then free forever.
const PREMIUM_PALETTES: Partial<Record<PaletteKey, number>> = {
  "midnight-obsidian": 150,
  "sunset-arcade": 100,
  "cyber-mint": 100,
};
const PREMIUM_HOVER: Partial<Record<HoverHueKey, number>> = {
  ultraviolet: 75,
  "gold-rush": 75,
  "blood-moon": 75,
  vaporwave: 50,
};
const cosmeticKey = (kind: "palette" | "hover", key: string) => `${kind}:${key}`;

export function ThemeCustomizer() {
  const { user } = useAuth();
  const [saved, setSaved] = useState<Customization>(() => loadCustomization());
  const [draft, setDraft] = useState<Customization>(() => loadCustomization());
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadCustomization();
    setSaved(loaded);
    setDraft(loaded);
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("cosmetic_unlocks")
      .select("cosmetic_key")
      .eq("user_id", user.id)
      .then(({ data }) => setUnlocked(new Set((data ?? []).map((r) => r.cosmetic_key as string))));
  }, [user]);

  const requireUnlock = useCallback(
    async (key: string, cost: number, label: string) => {
      if (unlocked.has(key)) return true;
      if (!user) {
        toast.error("Sign in to unlock cosmetics");
        return false;
      }
      setPending(key);
      const { error } = await supabase.rpc("unlock_cosmetic", { _key: key, _cost: cost });
      setPending(null);
      if (error) {
        toast.error(error.message.includes("Insufficient") ? "Not enough tokens" : error.message);
        return false;
      }
      setUnlocked((prev) => new Set(prev).add(key));
      toast.success(`${label} unlocked · -${cost} tokens`);
      return true;
    },
    [unlocked, user],
  );

  // Live preview while editing — never persists.
  useEffect(() => { previewCustomization(draft); }, [draft]);

  const dirty = useMemo(() => JSON.stringify(saved) !== JSON.stringify(draft), [saved, draft]);

  const set = <K extends keyof Customization>(k: K, v: Customization[K]) => {
    sfx.tap();
    setDraft((p) => ({ ...p, [k]: v }));
  };

  const handleSave = () => {
    saveCustomization(draft);
    setSaved(draft);
    sfx.tap();
    toast.success("Theme saved — applied everywhere");
  };

  const handleDiscard = () => {
    setDraft(saved);
    applyCustomization(saved);
    sfx.tap();
  };

  const handleReset = () => {
    setDraft(DEFAULT_CUSTOMIZATION);
    sfx.tap();
  };

  return (
    <div className="space-y-5">
      <Group icon={Layers} title="Palette presets">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(PALETTES) as PaletteKey[]).map((k) => {
            const p = PALETTES[k];
            const on = draft.palette === k;
            const cost = PREMIUM_PALETTES[k];
            const ck = cosmeticKey("palette", k);
            const locked = cost != null && !unlocked.has(ck);
            const busy = pending === ck;
            return (
              <button
                key={k}
                disabled={busy}
                onClick={async () => {
                  if (locked) {
                    const ok = await requireUnlock(ck, cost!, p.name);
                    if (!ok) return;
                  }
                  applyPalettePreset(k);
                  const fresh = loadCustomization();
                  setSaved(fresh);
                  setDraft(fresh);
                  toast.success(`${p.name} applied`);
                }}
                className={cn(
                  "relative rounded-xl border-2 p-2 text-left overflow-hidden transition-all disabled:opacity-60",
                  on ? "border-primary scale-[1.02]" : "border-border hover:border-primary/60"
                )}
              >
                <div className="h-12 rounded-lg mb-1.5 ring-1 ring-white/10 relative" style={{ backgroundImage: p.gradient }}>
                  {locked && (
                    <span className="absolute inset-0 grid place-items-center bg-black/50 rounded-lg text-[10px] font-bold text-white gap-1">
                      <Lock className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[11px] font-bold leading-tight truncate">{p.name}</p>
                  {locked && <span className="text-[9px] font-bold text-primary shrink-0">{cost}⨀</span>}
                </div>
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{p.mode}</p>
              </button>
            );
          })}
        </div>
      </Group>

      <Group icon={Palette} title="Accent color">
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
            const a = ACCENTS[k];
            const on = draft.accent === k;
            return (
              <button
                key={k}
                onClick={() => set("accent", k)}
                className={cn(
                  "group relative aspect-square rounded-2xl border-2 transition-all duration-200 overflow-hidden",
                  on ? "border-foreground scale-[1.04]" : "border-border hover:scale-105"
                )}
                style={{ background: `linear-gradient(135deg, ${a.swatch}, color-mix(in oklab, ${a.swatch} 55%, #000))` }}
                title={a.name}
              >
                <span className="absolute inset-x-0 bottom-0 text-[9px] font-bold uppercase tracking-wider bg-black/40 text-white py-0.5">{a.name}</span>
                {on && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-white shadow" />}
              </button>
            );
          })}
        </div>
      </Group>

      <Group icon={Sparkles} title="Hover hue">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(HOVER_HUES) as HoverHueKey[]).map((k) => {
            const h = HOVER_HUES[k];
            const on = (draft.hoverHue ?? "auto") === k;
            const cost = PREMIUM_HOVER[k];
            const ck = cosmeticKey("hover", k);
            const locked = cost != null && !unlocked.has(ck);
            const busy = pending === ck;
            const gradient = h.swatches.length
              ? `conic-gradient(from 180deg, ${h.swatches.join(", ")}, ${h.swatches[0]})`
              : "conic-gradient(from 180deg, var(--primary), var(--primary-glow), var(--primary))";
            return (
              <button
                key={k}
                disabled={busy}
                onClick={async () => {
                  if (locked) {
                    const ok = await requireUnlock(ck, cost!, h.name);
                    if (!ok) return;
                  }
                  set("hoverHue", k);
                }}
                className={cn(
                  "group relative rounded-xl border-2 p-2 text-left overflow-hidden transition-all hover:scale-[1.03] disabled:opacity-60",
                  on ? "border-foreground scale-[1.04]" : "border-border hover:border-primary/60"
                )}
                title={h.name}
              >
                <div
                  className="h-10 w-full rounded-lg mb-1 ring-1 ring-white/10 transition-transform duration-700 group-hover:rotate-[40deg] relative"
                  style={{ backgroundImage: gradient }}
                >
                  {locked && (
                    <span className="absolute inset-0 grid place-items-center bg-black/50 rounded-lg text-white">
                      <Lock className="h-3 w-3" />
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <p className="text-[10px] font-bold leading-tight truncate">{h.name}</p>
                  {locked && <span className="text-[9px] font-bold text-primary shrink-0">{cost}⨀</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Group>

      {/* Backgrounds live in "Your cosmetics" (shop-owned) — removed here to avoid duplicate, conflicting controls. */}


      <Group icon={Type} title="Display font">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FONT_FAMILIES) as FontKey[]).map((k) => {
            const f = FONT_FAMILIES[k];
            const on = draft.font === k;
            return (
              <button
                key={k}
                onClick={() => set("font", k)}
                className={cn(
                  "px-3 py-3 rounded-xl border-2 text-left transition-all",
                  on ? "border-primary bg-primary/10" : "border-border hover:border-primary/60"
                )}
              >
                <p className="text-base font-black" style={{ fontFamily: f.family }}>{f.name}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground" style={{ fontFamily: f.family }}>Aa · 123 · Gg</p>
              </button>
            );
          })}
        </div>
      </Group>

      <Group icon={Gauge} title="Text density">
        <div className="grid grid-cols-2 gap-2">
          {(["comfy", "compact"] as DensityKey[]).map((k) => (
            <button
              key={k}
              onClick={() => set("fontDensity", k)}
              className={cn("px-3 py-2.5 rounded-xl border-2 text-sm font-bold capitalize transition-all", draft.fontDensity === k ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}
            >
              <span className="block">{k}</span>
              <span className="block text-[10px] font-normal text-muted-foreground normal-case">{k === "compact" ? "Smaller text, more on screen" : "Standard, easier to read"}</span>
            </button>
          ))}
        </div>
      </Group>

      <Group icon={Gauge} title="Layout density">
        <div className="grid grid-cols-2 gap-2">
          {(["comfy", "compact"] as DensityKey[]).map((k) => (
            <button
              key={k}
              onClick={() => { set("layoutDensity", k); set("density", k); }}
              className={cn("px-3 py-2.5 rounded-xl border-2 text-sm font-bold capitalize transition-all", draft.layoutDensity === k ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}
            >
              <span className="block">{k}</span>
              <span className="block text-[10px] font-normal text-muted-foreground normal-case">{k === "compact" ? "Tight padding & gaps" : "Spacious & relaxed"}</span>
            </button>
          ))}
        </div>
      </Group>


      <Group icon={Sparkles} title="Animation feel">
        <div className="grid grid-cols-3 gap-2">
          {(["smooth", "snappy", "reduced"] as AnimKey[]).map((k) => (
            <button
              key={k}
              onClick={() => set("anim", k)}
              className={cn("px-2 py-2 rounded-xl border-2 text-xs font-bold capitalize transition-all", draft.anim === k ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}
            >{k}</button>
          ))}
        </div>
      </Group>

      <Group icon={Wand2} title={`Corner radius — ${draft.radius}px`}>
        <Slider min={2} max={28} step={1} value={[draft.radius]} onValueChange={(v) => set("radius", v[0])} />
      </Group>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-1 pt-3">
        <div className={cn(
          "rounded-2xl border bg-surface/90 backdrop-blur-xl p-3 flex items-center gap-2 transition-all",
          dirty ? "border-primary shadow-[0_10px_40px_-10px_color-mix(in_oklab,var(--primary)_50%,transparent)]" : "border-border"
        )}>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold">
              {dirty ? "Unsaved changes" : "All changes saved"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {dirty ? "Preview is live — save to keep across refresh." : "Theme applied across every tab."}
            </p>
          </div>
          {dirty && (
            <Button variant="ghost" size="sm" onClick={handleDiscard} className="h-9">
              <Undo2 className="h-4 w-4 mr-1" /> Discard
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!dirty} className="h-9 font-bold">
            <Check className="h-4 w-4 mr-1" /> Save changes
          </Button>
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={handleReset}>
        <RotateCcw className="h-4 w-4 mr-2" /> Reset to defaults
      </Button>
    </div>
  );
}

function Group({ icon: Icon, title, children }: { icon: typeof Palette; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-primary" />
        <p className="font-semibold text-sm">{title}</p>
      </div>
      {children}
    </div>
  );
}
