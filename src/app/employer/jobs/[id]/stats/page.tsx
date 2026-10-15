import type { Metadata } from "next";
import { Suspense } from "react";
import { JobStats } from "@/components/employer/JobStats";

export const metadata: Metadata = { title: "职位数据", robots: { index: false } };

export default function JobStatsPage({ params }: PageProps<"/employer/jobs/[id]/stats">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md border border-border bg-surface" />}>
      <Stats params={params} />
    </Suspense>
  );
}

async function Stats({ params }: Pick<PageProps<"/employer/jobs/[id]/stats">, "params">) {
  const { id } = await params;
  return <JobStats jobId={id} />;
}
