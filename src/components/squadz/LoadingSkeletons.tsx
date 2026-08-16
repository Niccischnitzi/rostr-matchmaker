import { Skeleton } from "@/components/ui/skeleton";

/** Card grid skeleton — matches clan/club/tournament card grids. */
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-4/5" />
        </div>
      ))}
    </div>
  );
}

/** Profile header skeleton — avatar + handle + stats row. */
export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}

/** Reels/video feed skeleton — vertical stacked media cards. */
export function ReelSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden">
          <Skeleton className="aspect-[9/16] w-full max-h-[520px]" />
          <div className="p-3 space-y-2">
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Avatar + two lines list rows — conversations, friends, members, LFG rows.
 * The default shape matches the DM list so the swap to real data is invisible.
 */
export function ListRowsSkeleton({
  count = 5,
  className = "",
  trailing = true,
}: {
  count?: number;
  className?: string;
  trailing?: boolean;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
        >
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2 w-2/3" />
          </div>
          {trailing && <Skeleton className="h-7 w-16 rounded-full shrink-0" />}
        </div>
      ))}
    </div>
  );
}

/** Chat message stream skeleton — alternating bubble widths. */
export function MessagesSkeleton({ count = 6 }: { count?: number }) {
  const widths = ["w-40", "w-56", "w-32", "w-48", "w-60", "w-36"];
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`flex ${i % 2 ? "justify-end" : "justify-start"}`}>
          <Skeleton className={`h-9 rounded-2xl ${widths[i % widths.length]} max-w-[70%]`} />
        </div>
      ))}
    </div>
  );
}
