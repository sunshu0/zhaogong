import { DetailPageSkeleton } from "@/components/ui/Skeleton";

// Shown at once while an employer page comes from the server (Round 19): no blank screen between pages.
export default function Loading() {
  return <DetailPageSkeleton label="正在加载" />;
}
