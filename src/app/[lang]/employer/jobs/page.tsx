import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageJobs } from "@/components/employer/ManageJobs";
import { ListPageSkeleton } from "@/components/ui/Skeleton";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await messages(employerJobsMessages);
  return { title: t.pageTitles.manage, robots: { index: false } };
}

export default function ManageJobsPage() {
  // The list opens at the tab its address names (?tab=ending from a closing reminder, #69).
  return (
    <Suspense fallback={<ListPageSkeleton />}>
      <ManageJobs />
    </Suspense>
  );
}
