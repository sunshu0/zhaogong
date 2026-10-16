import type { Metadata } from "next";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { regionById } from "@/config/countries";
import { getEmployer, getJob, listJobs } from "@/lib/data";
import { BackLink } from "@/components/seeker/BackLink";
import { RecordView } from "@/components/seeker/RecordView";
import { ApplyJob } from "@/components/seeker/ApplyJob";
import { PayReferenceBox } from "@/components/ui/PayReferenceBox";
import { payReference } from "@/lib/pay-reference";
import { ReportJob } from "@/components/seeker/ReportJob";
import { FinishSaveAfterSignIn } from "@/components/seeker/SaveJobButton";
import { ShareJobButton } from "@/components/seeker/ShareJob";
import { Phone } from "lucide-react";
import { formatPay } from "@/components/seeker/format";
import { JobDetail, JobDetailSkeleton } from "@/components/seeker/JobDetail";
import { contactKinds, isPublic, shareDescription, shareTitle } from "@/components/seeker/job-facts";
import { ContactReveal } from "@/components/seeker/ContactReveal";
import { requestTime } from "@/components/seeker/request-time";
import { shareSummary } from "@/components/seeker/share";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { StartEmployerChat } from "@/components/seeker/StartEmployerChat";
import { isExpired } from "@/components/seeker/job-facts";
import { jobPostingJsonLd, jsonLdText } from "@/lib/job-posting";
import { siteOrigin } from "@/lib/site";
import type { Employer, Job as JobRecord } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/jobs/[id]">): Promise<Metadata> {
  const job = await getJob((await params).id);
  if (!job || !isPublic(job)) return { title: "职位不存在" };
  const title = shareTitle(job);
  const description = shareDescription(job, await getEmployer(job.employerId));
  return { title, description, openGraph: { title, description, type: "website", locale: "zh_CN" } };
}

// Round 19 sample (操作质感): with the job list, the first page in the new type (`type-app`) and cards.
export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <div className={`${WIDE_ON_DESKTOP} type-app`}>
      <div className="mb-2">
        <BackLink />
      </div>
      <NoScriptStreams />
      <Suspense fallback={<JobDetailSkeleton />}>
        <Job params={params} />
      </Suspense>
    </div>
  );
}

async function Job({ params }: Pick<PageProps<"/jobs/[id]">, "params">) {
  const job = await getJob((await params).id);
  if (!job || !isPublic(job)) notFound();
  // The request's time first: the open jobs are counted at it (#100).
  const now = await requestTime();
  const [employer, open] = await Promise.all([getEmployer(job.employerId), listJobs({ country: job.country }, now)]);
  // 时薪参考 (#85): the other open jobs of the industry, in the region or across its area.
  const reference = payReference(open, {
    country: job.country,
    industry: job.industry,
    regionId: job.regionId,
    exclude: job.id,
  });

  return (
    <>
      {employer && !employer.bannedAt && !isExpired(job, now) && <JobPostingData job={job} employer={employer} />}
      <JobDetail
        job={job}
        employer={employer}
        now={now}
        payReference={
          <PayReferenceBox
            reference={reference}
            at={new Date(now).toISOString()}
            country={job.country}
            industry={job.industry}
            look="card"
          />
        }
        share={<ShareJobButton path={`/jobs/${job.id}`} title={shareTitle(job)} summary={shareSummary(job)} />}
        actions={
          employer && !employer.bannedAt ? (
            <>
              {/* The main action takes the room that is left; its label never wraps. */}
              <div className="min-w-0 flex-1 md:flex-none [&_a]:w-full [&_button]:w-full">
                <StartEmployerChat
                  size="lg"
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
              </div>
              {!isExpired(job, now) && (
                <ApplyJob size="lg" jobId={job.id} jobTitle={job.titleZh} employerId={job.employerId} />
              )}
              {job.contactPublic && (
                <a
                  href="#contact"
                  aria-label="查看联系方式"
                  title="查看联系方式"
                  className="pressable flex size-12 shrink-0 items-center justify-center rounded-control border border-brand/40 bg-surface text-brand hover:bg-brand-soft"
                >
                  <Phone aria-hidden="true" className="size-5" />
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
                  className="space-y-3 rounded-card bg-surface p-4 shadow-card lg:p-5"
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
        <FinishSaveAfterSignIn />
      </JobDetail>
    </>
  );
}

/** schema.org JobPosting for search engines (R-32), only while the job is open; never the contact details. */
async function JobPostingData({ job, employer }: { job: JobRecord; employer: Employer }) {
  const request = await headers();
  const origin = siteOrigin(process.env.SITE_URL, request.get("host"), request.get("x-forwarded-proto"));
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdText(jobPostingJsonLd(job, employer, origin)) }}
    />
  );
}
