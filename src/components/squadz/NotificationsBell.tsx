import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useNotifications } from "@/hooks/use-notifications";
import { cn } from "@/lib/utils";

/**
 * Bell button with unread pip + realtime toast for freshly arrived items.
 * Clicking opens /inbox. Toasts fire only for rows we haven't already seen.
 */
export function NotificationsBell({ compact = false }: { compact?: boolean }) {
  const { rows, unread } = useNotifications();
  const nav = useNavigate();
  const seenRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);

  useEffect(() => {
    // Prime the seen set on first paint so we don't toast the initial history.
    if (!hydratedRef.current) {
      rows.forEach((r) => seenRef.current.add(r.id));
      hydratedRef.current = true;
      return;
    }
    for (const r of rows) {
      if (seenRef.current.has(r.id)) continue;
      seenRef.current.add(r.id);
      if (r.read_at) continue;
      toast(r.title ?? "New notification", {
        description: r.body ?? undefined,
        action: {
          label: "Open",
          onClick: () => nav({ to: "/inbox" }),
        },
      });
    }
  }, [rows, nav]);

  return (
    <button
      onClick={() => nav({ to: "/inbox" })}
      aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
      className={cn(
        "relative grid place-items-center rounded-lg bg-surface hover:bg-surface-2 transition",
        compact ? "h-7 w-7" : "h-9 w-9",
      )}
    >
      <Bell className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      {unread > 0 && (
        <span
          className={cn(
            "absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-black grid place-items-center leading-none",
            "shadow-[0_0_0_2px_hsl(var(--background))] animate-[pulse_2s_ease-in-out_infinite]",
          )}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
