import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ACCENTS, FONT_FAMILIES, PALETTES, HOVER_HUES,
  loadCustomization, saveCustomization, previewCustomization, applyCustomization,
  type AccentKey, type DensityKey, type FontKey, type PaletteKey, type HoverHueKey,
  DEFAULT_CUSTOMIZATION, type Customization,
} from "@/lib/customization";

import { Slider } from "@/components/ui/slider";
import { Check, ChevronDown, Lock, RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// Premium cosmetics — cost Shards to unlock once, then free forever.
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

// Curated short lists keep the default view calm. Everything else is optional.
const CORE_FONTS: FontKey[] = ["satoshi", "inter", "grotesk", "mono"];

export function ThemeCustomizer() {
  const { user } = useAuth();
  const [saved, setSaved] = useState<Customization>(() => loadCustomization());
  const [draft, setDraft] = useState<Customization>(() => loadCustomization());
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState(false);

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
        toast.error(error.message.includes("Insufficient") ? "Not enough Shards" : error.message);
        return false;
      }
      setUnlocked((prev) => new Set(prev).add(key));
      toast.success(`${label} unlocked · -${cost} Shards`);
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
    toast.success("Theme saved");
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
    <div className="space-y-4">
      {/* Accent — the one decision that changes the whole app. */}
      <Row label="Accent" hint={ACCENTS[draft.accent].name}>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
            const a = ACCENTS[k];
            const on = draft.accent === k;
            return (
              <button
                key={k}
                onClick={() => set("accent", k)}
                title={a.name}
                aria-label={a.name}
                aria-pressed={on}
                className={cn(
                  "h-8 w-8 rounded-full transition-all",
                  on ? "ring-2 ring-offset-2 ring-foreground ring-offset-background" : "opacity-80 hover:opacity-100",
                )}
                style={{ background: a.swatch }}
              />
            );
          })}
        </div>
      </Row>

      {/* Typeface — 4 curated options. */}
      <Row label="Typeface" hint={FONT_FAMILIES[draft.font].name}>
        <div className="grid grid-cols-4 gap-1.5">
          {CORE_FONTS.map((k) => {
            const f = FONT_FAMILIES[k];
            const on = draft.font === k;
            return (
              <button
                key={k}
                onClick={() => set("font", k)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-center transition-colors",
                  on ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                )}
              >
                <span className="block text-sm font-bold" style={{ fontFamily: f.family }}>Aa</span>
                <span className="block text-[9px] uppercase tracking-wider text-muted-foreground truncate">{f.name}</span>
              </button>
            );
          })}
        </div>
      </Row>

      {/* Density — one control, applied to text and layout together. */}
      <Row label="Density" hint={draft.layoutDensity === "compact" ? "Compact" : "Comfortable"}>
        <div className="grid grid-cols-2 gap-1.5">
          {(["comfy", "compact"] as DensityKey[]).map((k) => (
            <button
              key={k}
              onClick={() => { set("layoutDensity", k); set("density", k); set("fontDensity", k); }}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-bold transition-colors",
                draft.layoutDensity === k ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
              )}
            >
              {k === "compact" ? "Compact" : "Comfortable"}
            </button>
          ))}
        </div>
      </Row>

      {/* Everything else, folded away. */}
      <div className="rounded-2xl border border-border bg-surface/40">
        <button
          onClick={() => setAdvanced((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          aria-expanded={advanced}
        >
          <span>
            <span className="block text-sm font-semibold">More options</span>
            <span className="block text-[11px] text-muted-foreground">Presets, hover glow, corners, motion</span>
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", advanced && "rotate-180")} />
        </button>

        {advanced && (
          <div className="border-t border-border p-4 space-y-5">
            <Sub label="Presets">
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(PALETTES) as PaletteKey[]).map((k) => {
                  const p = PALETTES[k];
                  const on = draft.palette === k;
                  const cost = PREMIUM_PALETTES[k];
                  const ck = cosmeticKey("palette", k);
                  const locked = cost != null && !unlocked.has(ck);
                  return (
                    <button
                      key={k}
                      disabled={pending === ck}
                      title={`${p.name} · ${p.mode}`}
                      onClick={async () => {
                        if (locked) {
                          const ok = await requireUnlock(ck, cost!, p.name);
                          if (!ok) return;
                        }
                        const next: Customization = { ...draft, accent: p.accent, palette: k };
                        setDraft(next);
                      }}
                      className={cn(
                        "relative h-10 rounded-lg border transition-all disabled:opacity-60",
                        on ? "border-foreground" : "border-border hover:border-primary/50",
                      )}
                      style={{ backgroundImage: p.gradient }}
                    >
                      {locked && (
                        <span className="absolute inset-0 grid place-items-center rounded-lg bg-black/50 text-white">
                          <Lock className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Sub>

            <Sub label="Hover glow">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(HOVER_HUES) as HoverHueKey[]).map((k) => {
                  const h = HOVER_HUES[k];
                  const on = (draft.hoverHue ?? "auto") === k;
                  const cost = PREMIUM_HOVER[k];
                  const ck = cosmeticKey("hover", k);
                  const locked = cost != null && !unlocked.has(ck);
                  const gradient = h.swatches.length
                    ? `conic-gradient(from 180deg, ${h.swatches.join(", ")}, ${h.swatches[0]})`
                    : "conic-gradient(from 180deg, var(--primary), var(--primary-glow), var(--primary))";
                  return (
                    <button
                      key={k}
                      disabled={pending === ck}
                      title={h.name}
                      aria-label={h.name}
                      onClick={async () => {
                        if (locked) {
                          const ok = await requireUnlock(ck, cost!, h.name);
                          if (!ok) return;
                        }
                        set("hoverHue", k);
                      }}
                      className={cn(
                        "relative h-8 w-8 rounded-full transition-all disabled:opacity-60",
                        on ? "ring-2 ring-offset-2 ring-foreground ring-offset-background" : "opacity-80 hover:opacity-100",
                      )}
                      style={{ backgroundImage: gradient }}
                    >
                      {locked && (
                        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/50 text-white">
                          <Lock className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </Sub>

            <Sub label={`Corners — ${draft.radius}px`}>
              <Slider min={2} max={28} step={1} value={[draft.radius]} onValueChange={(v) => set("radius", v[0])} />
            </Sub>

            <Sub label="Motion">
              <div className="grid grid-cols-3 gap-1.5">
                {(["smooth", "snappy", "reduced"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => set("anim", k)}
                    className={cn(
                      "rounded-lg border px-2 py-2 text-xs font-bold capitalize transition-colors",
                      draft.anim === k ? "border-primary bg-primary/10" : "border-border hover:border-primary/50",
                    )}
                  >{k}</button>
                ))}
              </div>
            </Sub>

            <Button variant="ghost" size="sm" className="w-full" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-2" /> Reset to defaults
            </Button>
          </div>
        )}
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-1 pt-3">
        <div className={cn(
          "rounded-2xl border bg-surface/90 backdrop-blur-xl p-3 flex items-center gap-2 transition-colors",
          dirty ? "border-primary" : "border-border",
        )}>
          <p className="flex-1 min-w-0 text-xs font-semibold truncate">
            {dirty ? "Unsaved changes — preview is live" : "All changes saved"}
          </p>
          {dirty && (
            <Button variant="ghost" size="sm" onClick={handleDiscard} className="h-9">
              <Undo2 className="h-4 w-4 mr-1" /> Discard
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={!dirty} className="h-9 font-bold">
            <Check className="h-4 w-4 mr-1" /> Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface/40 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-semibold">{label}</p>
        {hint && <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

function Sub({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      {children}
    </div>
  );
}
