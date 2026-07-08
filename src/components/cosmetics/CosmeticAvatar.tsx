import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  haloClass?: string | null;
  frameClass?: string | null;
  size?: number;
  className?: string;
}

/**
 * Wraps an <Avatar/> (or any square element) with the user's equipped
 * cosmetic halo and frame overlays. Overlays are absolute-positioned so they
 * never affect the underlying layout.
 */
export function CosmeticAvatar({ children, haloClass, frameClass, size = 48, className }: Props) {
  return (
    <div
      className={cn("relative inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {haloClass && <div className={cn("cosmetic-halo pointer-events-none absolute inset-0", haloClass)} aria-hidden />}
      {frameClass && <div className={cn("cosmetic-frame pointer-events-none absolute inset-0 rounded-full", frameClass)} aria-hidden />}
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}
