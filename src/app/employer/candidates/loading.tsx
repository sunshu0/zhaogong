import { ListPageSkeleton } from "@/components/ui/Skeleton";

// Shown at once while 推荐人才 comes from the server (Round 19): no blank screen between pages.
export default function Loading() {
  return <ListPageSkeleton label="正在加载推荐人才" />;
}
