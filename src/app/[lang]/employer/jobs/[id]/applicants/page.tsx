import type { Metadata } from "next";
import { Suspense } from "react";
import { JobApplicants } from "@/components/employer/JobApplicants";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";
import { messages } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await messages(employerApplicantsMessages);
  return { title: t.applicantsPage.metaTitle, robots: { index: false } };
}

/** 申请人 (#84): who applied for one of the business's jobs, from its card on 职位管理. */
export default function JobApplicantsPage({ params }: PageProps<"/[lang]/employer/jobs/[id]/applicants">) {
  return (
    <Suspense fallback={<DetailPageSkeleton />}>
      <Applicants params={params} />
    </Suspense>
  );
}

async function Applicants({ params }: Pick<PageProps<"/[lang]/employer/jobs/[id]/applicants">, "params">) {
  const { id } = await params;
  return <JobApplicants jobId={id} />;
}
