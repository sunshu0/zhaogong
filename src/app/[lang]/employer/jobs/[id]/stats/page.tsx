import type { Metadata } from "next";
import { Suspense } from "react";
import { JobStats } from "@/components/employer/JobStats";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await messages(employerJobsMessages);
  return { title: t.pageTitles.stats, robots: { index: false } };
}

export default function JobStatsPage({ params }: PageProps<"/[lang]/employer/jobs/[id]/stats">) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <Stats params={params} />
    </Suspense>
  );
}

async function Stats({ params }: Pick<PageProps<"/[lang]/employer/jobs/[id]/stats">, "params">) {
  const { id } = await params;
  return <JobStats jobId={id} />;
}
