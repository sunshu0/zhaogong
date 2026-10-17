import { DetailPageSkeleton } from "@/components/ui/Skeleton";

// Shown at once while this page comes from the server (Round 19): no blank screen between pages.
export default function Loading() {
  return <DetailPageSkeleton label="加载雇主主页…" />;
}
