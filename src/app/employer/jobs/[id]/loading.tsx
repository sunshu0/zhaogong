import { DetailPageSkeleton } from "@/components/ui/Skeleton";

// Shown at once while a job's page (编辑, 申请人, 数据, 重新发布) comes from the server (Round 19).
export default function Loading() {
  return <DetailPageSkeleton />;
}
