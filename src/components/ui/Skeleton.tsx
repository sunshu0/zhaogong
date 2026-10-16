/**
 * Skeletons (Round 19): grey shapes where content is on its way, gently pulsing, so a page never flashes white.
 * Hidden from screen readers; the loading region around them says it is busy (`aria-busy`). Shape them like what
 * comes: `Skeleton` is one block (pass its size), `SkeletonCard` a card of a list, `SkeletonList` a few of them.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-shimmer rounded-control bg-neutral-soft ${className}`.trim()} />;
}

export function SkeletonCard() {
  return (
    <div aria-hidden="true" className="space-y-3 rounded-card bg-surface p-4 shadow-card lg:p-5">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-7 w-16" />
      </div>
      <Skeleton className="h-4 w-1/3" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-12" />
        <Skeleton className="h-5 w-14" />
      </div>
    </div>
  );
}

/**
 * A list on its way: `count` cards and a line for screen readers. No role="status": pages already have their own
 * status messages, and a second one would make them ambiguous.
 */
export function SkeletonList({ count = 4, label = "正在加载" }: { count?: number; label?: string }) {
  return (
    <div aria-busy="true" className="space-y-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

/** A list page on its way (loading.tsx of the job lists): the title line, then cards. */
export function ListPageSkeleton({ label = "正在加载职位" }: { label?: string }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <SkeletonList label={label} />
    </div>
  );
}

/** A detail page on its way (loading.tsx of a job page): title, pay, facts. */
export function DetailPageSkeleton({ label = "正在加载职位" }: { label?: string }) {
  return (
    <div aria-busy="true" className="space-y-4 lg:max-w-3xl">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-3 rounded-card bg-surface p-4 shadow-card lg:p-5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <div aria-hidden="true" className="space-y-2 rounded-card bg-surface p-4 shadow-card lg:p-5">
        {[0, 1, 2, 3].map((line) => (
          <Skeleton key={line} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
