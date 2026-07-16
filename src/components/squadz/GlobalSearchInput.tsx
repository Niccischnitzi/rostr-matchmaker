import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Header search input. Submits to /search?q=... — the results page owns
 * the actual query. ⌘K / Ctrl+K focuses it from anywhere.
 */
export function GlobalSearchInput({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const [q, setQ] = useState("");
  const nav = useNavigate();
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = q.trim();
    if (!query) return;
    nav({ to: "/search", search: { q: query } });
  };

  return (
    <form
      onSubmit={submit}
      className={cn(
        "relative flex items-center rounded-lg bg-surface/70 border border-border focus-within:border-primary/50 transition",
        compact ? "h-7 px-2" : "h-9 px-3",
        className,
      )}
    >
      <SearchIcon className={cn("text-muted-foreground shrink-0", compact ? "h-3 w-3" : "h-4 w-4")} />
      <input
        ref={ref}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={compact ? "Search" : "Search players & crews"}
        className={cn(
          "bg-transparent border-0 outline-none ml-2 min-w-0 flex-1 text-foreground placeholder:text-muted-foreground",
          compact ? "text-[11px]" : "text-sm",
        )}
      />
      {!compact && (
        <kbd className="hidden md:inline-flex items-center gap-0.5 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5 font-mono">
          ⌘K
        </kbd>
      )}
    </form>
  );
}
