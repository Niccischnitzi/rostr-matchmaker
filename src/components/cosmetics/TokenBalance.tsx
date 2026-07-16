import { useNavigate } from "@tanstack/react-router";
import { useWallet } from "@/hooks/use-wallet";
import { cn } from "@/lib/utils";
import { ShardIcon } from "./ShardIcon";

/**
 * Shard balance chip (formerly TokenBalance). Click to open the shop.
 * Uses the ShardIcon crystal glyph with a subtle pulse ring on hover.
 */
export function ShardBalance({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const { balance } = useWallet();
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav({ to: "/shop" })}
      className={cn(
        "group relative inline-flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary transition font-bold overflow-hidden",
        compact ? "h-7 px-2 text-[10px]" : "h-9 px-3 text-sm",
        className,
      )}
      aria-label={`Shard balance ${balance ?? 0} — open shop`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-primary/25 to-transparent"
      />
      <ShardIcon size={compact ? 12 : 15} spinning />
      <span className="tabular-nums">{balance == null ? "—" : balance.toLocaleString()}</span>
    </button>
  );
}

// Back-compat: existing imports keep working.
export const TokenBalance = ShardBalance;
