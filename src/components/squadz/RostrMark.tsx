import logoAsset from "@/assets/rostr-r-v2.png.asset.json";
import { cn } from "@/lib/utils";

type Variant = "mark" | "wordmark" | "lockup";

/**
 * Unified brand mark. Three variants share one asset + gradient token so
 * every surface (auth, shop, settings, footer, share cards) reads as
 * "the same Rostr".
 *
 *  - mark:      icon only (chip / avatar / favicon-style)
 *  - lockup:    icon + wordmark (default header usage)
 *  - wordmark:  type only (dense chrome, footers, sub-brand chips)
 */
export function RostrMark({
  size = 48,
  variant = "mark",
  className,
  tone = "primary",
}: {
  size?: number;
  variant?: Variant;
  className?: string;
  tone?: "primary" | "muted";
}) {
  if (variant === "wordmark") {
    return <Wordmark size={size} tone={tone} className={className} />;
  }
  if (variant === "lockup") {
    return (
      <span className={cn("inline-flex items-center gap-2.5", className)}>
        <Icon size={size} />
        <Wordmark size={Math.round(size * 0.72)} tone={tone} />
      </span>
    );
  }
  return <Icon size={size} className={className} />;
}

function Icon({ size, className }: { size: number; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-grid place-items-center rounded-[22%] overflow-hidden",
        "bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/.9),hsl(var(--primary)/.55)_55%,hsl(var(--primary)/.35))]",
        "shadow-[0_6px_24px_-6px_hsl(var(--primary)/.55)]",
        className,
      )}
      style={{ width: size, height: size }}
      aria-label="Rostr"
    >
      <img
        src={logoAsset.url}
        alt=""
        width={size}
        height={size}
        className="h-[86%] w-[86%] object-contain"
        draggable={false}
      />
    </span>
  );
}

function Wordmark({ size, tone, className }: { size: number; tone: "primary" | "muted"; className?: string }) {
  return (
    <span
      className={cn(
        "font-display font-black tracking-[-0.04em] leading-none select-none",
        tone === "primary" ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      style={{ fontSize: size }}
    >
      rostr<span className="text-primary">.</span>
    </span>
  );
}

export const ROSTR_LOGO_URL = logoAsset.url;
