import { useEffect, useState } from "react";
import { AVATAR_STYLES, AVATAR_PACKS, type AvatarPack } from "@/lib/customization";
import { cn } from "@/lib/utils";
import { sfx } from "@/lib/sfx";

type Props = {
  value?: string | null;
  onChange: (url: string) => void;
  className?: string;
};

export function AvatarPicker({ value, onChange, className }: Props) {
  const [pack, setPack] = useState<AvatarPack>("bots");
  useEffect(() => {
    // Try to infer current pack from the URL.
    if (!value) return;
    const match = AVATAR_STYLES.find((s) => value.includes(s.key) || value.includes(s.build("x").split("?")[0].split("/").slice(-2)[0]));
    if (match) setPack(match.key);
  }, [value]);

  const style = AVATAR_STYLES.find((s) => s.key === pack) ?? AVATAR_STYLES[0];
  const seeds = AVATAR_PACKS[pack];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-1.5 p-1 bg-surface rounded-xl border border-border">
        {AVATAR_STYLES.map((s) => {
          const active = s.key === pack;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => { sfx.tap(); setPack(s.key); }}
              className={cn(
                "flex-1 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                active ? "bg-primary text-primary-foreground glow-orange" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.name}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-4 gap-2.5">
        {seeds.map((seed) => {
          const url = style.build(seed);
          const on = value === url;
          return (
            <button
              key={seed}
              type="button"
              onClick={() => { sfx.tap(); onChange(url); }}
              className={cn(
                "aspect-square rounded-2xl overflow-hidden border-2 transition-all duration-200 ease-out will-change-transform",
                on ? "border-primary ring-2 ring-primary/40 scale-[1.04] glow-orange" : "border-border hover:border-primary/60 hover:scale-105"
              )}
            >
              <img src={url} alt={seed} loading="lazy" className="h-full w-full object-cover" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
