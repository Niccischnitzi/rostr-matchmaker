import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  haloClass?: string | null;
  frameClass?: string | null;
  size?: number;
  /** Corner rounding of the underlying element — overlays follow it exactly. */
  radiusClass?: string;
  className?: string;
}

/**
 * Wraps an <Avatar/> (or any square element) with the user's equipped
 * cosmetic halo and frame overlays. Overlays are absolute-positioned so they
 * never affect the underlying layout, and inherit the same corner radius so
 * frames never clip square over a rounded avatar.
 */
export function CosmeticAvatar({
  children,
  haloClass,
  frameClass,
  size = 48,
  radiusClass = "rounded-full",
  className,
}: Props) {
  return (
    <div
      className={cn("relative inline-block shrink-0", radiusClass, className)}
      style={{ width: size, height: size }}
    >
      {haloClass && (
        <div
          className={cn("cosmetic-halo pointer-events-none absolute inset-0 rounded-[inherit]", haloClass)}
          aria-hidden
        />
      )}
      {frameClass && (
        <div
          className={cn("cosmetic-frame pointer-events-none absolute inset-0 rounded-[inherit]", frameClass)}
          aria-hidden
        />
      )}
      <div className="relative h-full w-full overflow-hidden rounded-[inherit]">{children}</div>
    </div>
  );
}
