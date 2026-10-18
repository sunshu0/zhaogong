import { HubPageSkeleton } from "@/components/account/HubSkeletons";

// Shown at once while this page comes from the server (Round 19): no blank screen between pages.
export default function Loading() {
  return <HubPageSkeleton label="正在加载数据与账号" cards={[2, 3]} />;
}
