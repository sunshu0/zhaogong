import { Skeleton } from "@/components/ui/Skeleton";
import { WorkHubFrame } from "@/components/seeker/WorkHub";

/**
 * The account pages on their way (their loading.tsx, Round 19): the work hub's frame at once, then the shape of
 * the page in cards, so a tap on 我的 or 通知 never shows a blank screen. Hidden without JavaScript (#13).
 * `cards`: how many rows each card has.
 */
export function HubPageSkeleton({ label, cards = [1, 5] }: { label: string; cards?: number[] }) {
  return (
    <WorkHubFrame look="app">
      <div data-nojs-hide="" aria-busy="true" className="space-y-4">
        <span className="sr-only">{label}</span>
        <Skeleton className="h-8 w-36" />
        {cards.map((rows, card) => (
          <div
            key={card}
            aria-hidden="true"
            className="divide-y divide-border rounded-card bg-surface ring-1 ring-border"
          >
            {Array.from({ length: rows }, (_, row) => (
              <div key={row} className="flex items-center gap-3 px-4 py-3.5 lg:px-5">
                <Skeleton className="size-10 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </WorkHubFrame>
  );
}
