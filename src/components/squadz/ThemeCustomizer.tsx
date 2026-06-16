import { useEffect, useState } from "react";
import {
  ACCENTS, BACKGROUNDS, FONT_FAMILIES,
  loadCustomization, saveCustomization,
  type AccentKey, type BackgroundKey, type DensityKey, type FontKey, type AnimKey,
  DEFAULT_CUSTOMIZATION, type Customization,
} from "@/lib/customization";
import { Slider } from "@/components/ui/slider";
import { Sparkles, Palette, Type, Gauge, Wand2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";

export function ThemeCustomizer() {
  const [c, setC] = useState<Customization>(DEFAULT_CUSTOMIZATION);
  useEffect(() => { setC(loadCustomization()); }, []);
  useEffect(() => { saveCustomization(c); }, [c]);

  const set = <K extends keyof Customization>(k: K, v: Customization[K]) => { sfx.tap(); setC((p) => ({ ...p, [k]: v })); };

  return (
    <div className="space-y-5">
      <Group icon={Palette} title="Accent color">
        <div className="grid grid-cols-4 gap-2">
          {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
            const a = ACCENTS[k];
            const on = c.accent === k;
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

      <Group icon={Wand2} title="Background">
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(BACKGROUNDS) as BackgroundKey[]).map((k) => {
            const b = BACKGROUNDS[k];
            const on = c.background === k;
            return (
              <button
                key={k}
                onClick={() => set("background", k)}
                className={cn(
                  "h-16 rounded-xl border-2 transition-all overflow-hidden relative",
                  on ? "border-primary scale-[1.03]" : "border-border hover:border-primary/60"
                )}
                style={{ backgroundImage: b.css, backgroundSize: "cover" }}
                title={b.name}
              >
                <span className="absolute inset-x-0 bottom-0 text-[9px] font-bold uppercase tracking-wider bg-black/50 text-white py-0.5 text-center">{b.name}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group icon={Type} title="Display font">
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FONT_FAMILIES) as FontKey[]).map((k) => {
            const f = FONT_FAMILIES[k];
            const on = c.font === k;
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

      <Group icon={Gauge} title="Density">
        <div className="grid grid-cols-2 gap-2">
          {(["comfy", "compact"] as DensityKey[]).map((k) => (
            <button
              key={k}
              onClick={() => set("density", k)}
              className={cn("px-3 py-2.5 rounded-xl border-2 text-sm font-bold capitalize transition-all", c.density === k ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}
            >{k}</button>
          ))}
        </div>
      </Group>

      <Group icon={Sparkles} title="Animation feel">
        <div className="grid grid-cols-3 gap-2">
          {(["smooth", "snappy", "reduced"] as AnimKey[]).map((k) => (
            <button
              key={k}
              onClick={() => set("anim", k)}
              className={cn("px-2 py-2 rounded-xl border-2 text-xs font-bold capitalize transition-all", c.anim === k ? "border-primary bg-primary/10" : "border-border hover:border-primary/60")}
            >{k}</button>
          ))}
        </div>
      </Group>

      <Group icon={Wand2} title={`Corner radius — ${c.radius}px`}>
        <Slider min={2} max={28} step={1} value={[c.radius]} onValueChange={(v) => set("radius", v[0])} />
      </Group>

      <Button variant="outline" className="w-full" onClick={() => { sfx.tap(); setC(DEFAULT_CUSTOMIZATION); }}>
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
