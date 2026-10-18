import { ListPageSkeleton } from "@/components/ui/Skeleton";

// Shown at once while 职位管理 comes from the server (Round 19): no blank screen between pages.
export default function Loading() {
  return <ListPageSkeleton />;
}
