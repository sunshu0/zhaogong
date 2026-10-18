import { Loading as Cards } from "@/app/[lang]/admin/_components/Empty";
import { Skeleton } from "@/components/ui/Skeleton";

// Shown at once while this page comes from the server (Round 19): the title, the tabs and the queue's cards.
export default function Loading() {
  return (
    <div className="type-app space-y-4">
      <Skeleton className="h-8 w-32" />
      <Cards cards={1} height="h-20" />
      <Skeleton className="h-11 w-full" />
      <Cards />
    </div>
  );
}
