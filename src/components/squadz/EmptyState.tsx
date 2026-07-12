import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "arcade" | "cosmic" | "pixel" | "controller";

/** Playful, animated empty state used across tabs. */
export function EmptyState({
  title,
  body,
  action,
  variant = "arcade",
  className,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-dashed border-border bg-card/60 backdrop-blur px-6 py-12 text-center soft-rise",
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-primary/30 blur-3xl animate-pulse" />
        <div className="absolute -bottom-10 -right-10 h-40 w-40 rounded-full bg-accent/40 blur-3xl animate-pulse" />
      </div>
      <div className="relative flex flex-col items-center gap-4">
        <PixelArt variant={variant} />
        <div className="space-y-1">
          <h3 className="font-display text-xl font-black tracking-tight">{title}</h3>
          {body && <p className="text-sm text-muted-foreground max-w-sm mx-auto">{body}</p>}
        </div>
        {action && <div className="pt-2">{action}</div>}
      </div>
    </div>
  );
}

function PixelArt({ variant }: { variant: Variant }) {
  const grids: Record<Variant, string[]> = {
    arcade: [
      "..OOOOOO..",
      ".OOOOOOOO.",
      "OO.OOOO.OO",
      "OOOOOOOOOO",
      "OO.OOOO.OO",
      ".O.OOOO.O.",
      "..OO..OO..",
    ],
    cosmic: [
      "....OO....",
      "...OOOO...",
      "..OO..OO..",
      ".OO....OO.",
      "OO......OO",
      ".OO....OO.",
      "..OOOOOO..",
    ],
    pixel: [
      "OO..OO..OO",
      ".OOOO.OOOO",
      "..OO...OO.",
      "OOOOOOOOOO",
      "OO.OOOO.OO",
      "..OO..OO..",
      "OOOO..OOOO",
    ],
    controller: [
      "..OOOOOOOO..",
      ".OOOOOOOOOO.",
      "OO.OOOOOO.OO",
      "OOO.OOOO.OOO",
      "OO.OOOOOO.OO",
      ".OOOOOOOOOO.",
      "..OO....OO..",
    ],
  };
  const rows = grids[variant];
  return (
    <div className="pixel-bounce">
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${rows[0].length}, 8px)` }}
        aria-hidden
      >
        {rows.flatMap((row, y) =>
          row.split("").map((ch, x) => (
            <span
              key={`${y}-${x}`}
              className={cn(
                "h-2 w-2 rounded-[1px]",
                ch === "O" ? "bg-primary pixel-flicker" : "bg-transparent",
              )}
              style={{ animationDelay: `${(x + y) * 40}ms` }}
            />
          )),
        )}
      </div>
    </div>
  );
}
