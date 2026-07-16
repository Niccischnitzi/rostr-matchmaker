import { cn } from "@/lib/utils";

/**
 * Shard — the Rostr economy glyph (formerly "token").
 * Faceted crystal with an inner spark. Uses currentColor so it inherits
 * the primary accent everywhere it's placed.
 */
export function ShardIcon({
  size = 16,
  className,
  spinning = false,
}: {
  size?: number;
  className?: string;
  spinning?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      className={cn(spinning && "animate-[shard-spin_6s_linear_infinite]", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="shardFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      <path
        d="M12 2 L20 9 L12 22 L4 9 Z"
        fill="url(#shardFace)"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path d="M12 2 L12 22" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" />
      <path d="M4 9 L20 9" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" />
      <circle cx="12" cy="9" r="1.6" fill="white" fillOpacity="0.85">
        <animate attributeName="fillOpacity" values="0.85;0.35;0.85" dur="2.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
