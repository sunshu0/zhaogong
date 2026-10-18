import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageJobs } from "@/components/employer/ManageJobs";
import { ListPageSkeleton } from "@/components/ui/Skeleton";

export const metadata: Metadata = { title: "职位管理", robots: { index: false } };

export default function ManageJobsPage() {
  // The list opens at the tab its address names (?tab=ending from a closing reminder, #69).
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ManageJobs />
    </Suspense>
  );
}
