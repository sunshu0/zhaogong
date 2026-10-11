import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getEmployer, getJob } from "@/lib/data";
import { BackLink } from "@/components/seeker/BackLink";
import { ContactReveal } from "@/components/seeker/ContactReveal";
import { ReportJob } from "@/components/seeker/ReportJob";
import { JobDetail, JobDetailSkeleton } from "@/components/seeker/JobDetail";
import { contactKinds, isPublic, shareDescription, shareTitle } from "@/components/seeker/job-facts";
import { requestTime } from "@/components/seeker/request-time";

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const job = await getJob((await params).id);
  if (!job || !isPublic(job)) return { title: "职位不存在" };
  const title = shareTitle(job);
  const description = shareDescription(job, await getEmployer(job.employerId));
  return { title, description, openGraph: { title, description, type: "website", locale: "zh_CN" } };
}

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <>
      <div className="mb-2">
        <BackLink />
      </div>
      <Suspense fallback={<JobDetailSkeleton />}>
        <Job params={params} />
      </Suspense>
    </>
  );
}

async function Job({ params }: Pick<PageProps<"/jobs/[id]">, "params">) {
  const job = await getJob((await params).id);
  if (!job || !isPublic(job)) notFound();
  const [employer, now] = await Promise.all([getEmployer(job.employerId), requestTime()]);

  return (
    <JobDetail job={job} employer={employer} now={now}>
      <ContactReveal jobId={job.id} kinds={contactKinds(job)} />
      <ReportJob jobId={job.id} jobTitle={job.titleZh} />
    </JobDetail>
  );
}
