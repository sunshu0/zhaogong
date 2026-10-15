import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { regionById } from "@/config/countries";
import { getEmployer, getJob } from "@/lib/data";
import { BackLink } from "@/components/seeker/BackLink";
import { RecordView } from "@/components/seeker/RecordView";
import { ReportJob } from "@/components/seeker/ReportJob";
import { ShareJobButton } from "@/components/seeker/ShareJob";
import { buttonClass } from "@/components/ui/Button";
import { formatPay } from "@/components/seeker/format";
import { JobDetail, JobDetailSkeleton } from "@/components/seeker/JobDetail";
import { contactKinds, isPublic, shareDescription, shareTitle } from "@/components/seeker/job-facts";
import { ContactReveal } from "@/components/seeker/ContactReveal";
import { requestTime } from "@/components/seeker/request-time";
import { shareSummary } from "@/components/seeker/share";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { StartEmployerChat } from "@/components/seeker/StartEmployerChat";
import { isExpired } from "@/components/seeker/job-facts";

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const job = await getJob((await params).id);
  if (!job || !isPublic(job)) return { title: "职位不存在" };
  const title = shareTitle(job);
  const description = shareDescription(job, await getEmployer(job.employerId));
  return { title, description, openGraph: { title, description, type: "website", locale: "zh_CN" } };
}

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <div className={WIDE_ON_DESKTOP}>
      <div className="mb-2">
        <BackLink />
      </div>
      <Suspense fallback={<JobDetailSkeleton />}>
        <Job params={params} />
      </Suspense>
    </div>
  );
}

async function Job({ params }: Pick<PageProps<"/jobs/[id]">, "params">) {
  const job = await getJob((await params).id);
  if (!job || !isPublic(job)) notFound();
  const [employer, now] = await Promise.all([getEmployer(job.employerId), requestTime()]);

  return (
    <JobDetail
      job={job}
      employer={employer}
      now={now}
      share={<ShareJobButton path={`/jobs/${job.id}`} title={shareTitle(job)} summary={shareSummary(job)} />}
      actions={
        employer && !employer.bannedAt ? (
          <>
            <StartEmployerChat
              employer={{ id: employer.id, name: employer.name }}
              job={{
                id: job.id,
                employerId: job.employerId,
                titleZh: job.titleZh,
                status: job.status,
                expiresAt: job.expiresAt,
              }}
              closed={isExpired(job, now)}
            />
            {job.contactPublic && (
              <a href="#contact" className={buttonClass("secondary")}>
                查看联系方式
              </a>
            )}
          </>
        ) : undefined
      }
      aside={
        <>
          <div id="contact" className="scroll-mt-20">
            {job.contactPublic ? (
              <ContactReveal jobId={job.id} kinds={contactKinds(job)} />
            ) : (
              <section
                aria-labelledby="contact-heading"
                className="space-y-3 rounded-lg border border-border bg-surface p-4"
              >
                <h2 id="contact-heading" className="font-medium">
                  联系方式
                </h2>
                <p className="text-sm text-muted">
                  雇主没有公开联系方式。点「立即沟通」，在聊天里申请交换：你发起时先给出自己的联系方式，雇主同意后才会给你。
                </p>
                {employer && (
                  <Link
                    href={`/employers/${employer.id}`}
                    className="inline-flex min-h-11 items-center text-sm text-brand underline"
                  >
                    查看雇主主页
                  </Link>
                )}
              </section>
            )}
          </div>
        </>
      }
    >
      <RecordView
        jobId={job.id}
        title={job.titleZh}
        pay={formatPay(job.pay, job.country)}
        region={regionById(job.country, job.regionId)?.nameZh ?? ""}
      />
      <ReportJob jobId={job.id} jobTitle={job.titleZh} />
    </JobDetail>
  );
}
