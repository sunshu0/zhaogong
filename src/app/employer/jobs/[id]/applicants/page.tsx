import type { Metadata } from "next";
import { Suspense } from "react";
import { JobApplicants } from "@/components/employer/JobApplicants";

export const metadata: Metadata = { title: "申请人", robots: { index: false } };

/** 申请人 (#84): who applied for one of the business's jobs, from its card on 职位管理. */
export default function JobApplicantsPage({ params }: PageProps<"/employer/jobs/[id]/applicants">) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-md border border-border bg-surface" />}>
      <Applicants params={params} />
    </Suspense>
  );
}

async function Applicants({ params }: Pick<PageProps<"/employer/jobs/[id]/applicants">, "params">) {
  const { id } = await params;
  return <JobApplicants jobId={id} />;
}
