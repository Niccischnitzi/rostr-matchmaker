import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Signature "big ol' button" used on every empty state.
 * Rotating conic-gradient border + soft primary glow. Accessible, keyboard
 * focusable, respects prefers-reduced-motion via CSS animation.
 */
export const GlowButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  size?: "md" | "lg";
}>(function GlowButton({ children, className, icon, size = "lg", ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cn(
        "glow-btn group relative isolate inline-flex items-center justify-center gap-2",
        "font-black uppercase tracking-[0.18em] rounded-full",
        "text-primary-foreground",
        "transition-transform duration-200 active:scale-[0.97]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        size === "lg" ? "px-7 py-3.5 text-sm" : "px-5 py-2.5 text-xs",
        className,
      )}
    >
      {/* rotating conic border */}
      <span
        aria-hidden
        className="glow-btn__ring pointer-events-none absolute -inset-[2px] rounded-full"
      />
      {/* solid inner fill */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-primary"
      />
      {/* content */}
      <span className="relative z-10 inline-flex items-center gap-2">
        {icon}
        {children}
      </span>
      {/* soft halo */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-full bg-primary/30 blur-2xl opacity-60 group-hover:opacity-90 transition-opacity"
      />
    </button>
  );
});
