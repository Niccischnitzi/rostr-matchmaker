import { Coins } from "lucide-react";
import { useWallet } from "@/hooks/use-wallet";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function TokenBalance({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { balance } = useWallet();
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav({ to: "/shop" })}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary transition font-bold",
        compact ? "h-7 px-2 text-[10px]" : "h-9 px-3 text-sm",
        className,
      )}
      aria-label="Token balance — open shop"
    >
      <Coins className={compact ? "h-3 w-3" : "h-4 w-4"} />
      <span>{balance == null ? "—" : balance.toLocaleString()}</span>
    </button>
  );
}
