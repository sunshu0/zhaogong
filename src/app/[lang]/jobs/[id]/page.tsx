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
import { formatPay, placeName } from "@/components/seeker/format";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { messages, serverLang } from "@/i18n/server";
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
import { PageTransition } from "@/components/ui/PageTransition";
import { TrackView } from "@/components/ui/TrackView";

export async function generateMetadata({ params }: PageProps<"/[lang]/jobs/[id]">): Promise<Metadata> {
  const lang = await serverLang();
  const job = await getJob((await params).id);
  if (!job || !isPublic(job)) return { title: (await messages(seekerJobsMessages)).detail.notFoundTitle };
  // The share card stays Chinese (WeChat groups, like the share text); the English page's own title is English
  // where the employer wrote one.
  const title =
    lang === "en"
      ? [
          job.titleEn?.trim() || job.titleZh,
          formatPay(job.pay, job.country, "en"),
          placeName(regionById(job.country, job.regionId), "en"),
        ]
          .filter(Boolean)
          .join(" · ")
      : shareTitle(job);
  const description = shareDescription(job, await getEmployer(job.employerId));
  return {
    title,
    description,
    openGraph: { title: shareTitle(job), description, type: "website", locale: lang === "en" ? "en_NZ" : "zh_CN" },
  };
}

// Round 19 sample (操作质感): with the job list, the first page in the new type (`type-app`) and cards.
export default function JobPage({ params }: PageProps<"/[lang]/jobs/[id]">) {
  return (
    <PageTransition>
      <div className={`${WIDE_ON_DESKTOP} type-app`}>
        <div className="mb-2">
          <BackLink />
        </div>
        <NoScriptStreams />
        <Suspense fallback={<JobDetailSkeleton />}>
          <Job params={params} />
        </Suspense>
      </div>
    </PageTransition>
  );
}

async function Job({ params }: Pick<PageProps<"/[lang]/jobs/[id]">, "params">) {
  const job = await getJob((await params).id);
  if (!job || !isPublic(job)) notFound();
  const lang = await serverLang();
  const t = await messages(seekerJobsMessages);
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
      {/* The funnel's job step (#319, ADR 0025). */}
      <TrackView event={{ name: "job_view", path: "/jobs/[id]", jobId: job.id }} />
      {employer && !employer.bannedAt && !isExpired(job, now) && <JobPostingData job={job} employer={employer} />}
      <JobDetail
        job={job}
        employer={employer}
        now={now}
        lang={lang}
        payReference={
          <PayReferenceBox
            reference={reference}
            at={new Date(now).toISOString()}
            country={job.country}
            industry={job.industry}
            look="card"
            lang={lang}
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
                  aria-label={t.contact.show}
                  title={t.contact.show}
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
                <ContactReveal jobId={job.id} kinds={contactKinds(job, lang)} />
              ) : (
                <section
                  aria-labelledby="contact-heading"
                  className="space-y-3 rounded-card bg-surface p-4 shadow-card lg:p-5"
                >
                  <h2 id="contact-heading" className="font-medium">
                    {t.contact.title}
                  </h2>
                  <p className="text-sm text-muted">{t.contact.notPublic}</p>
                  {employer && (
                    <Link
                      href={`/employers/${employer.id}`}
                      className="inline-flex min-h-11 items-center text-sm text-brand underline"
                    >
                      {t.detail.employerPageShort}
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
          pay={formatPay(job.pay, job.country, lang)}
          region={placeName(regionById(job.country, job.regionId), lang) ?? ""}
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
