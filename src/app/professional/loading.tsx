import { ListPageSkeleton } from "@/components/ui/Skeleton";

// Shown at once while this page comes from the server (Round 19): no blank screen between pages.
export default function Loading() {
  return <ListPageSkeleton />;
}
