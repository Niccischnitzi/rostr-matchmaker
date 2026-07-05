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
