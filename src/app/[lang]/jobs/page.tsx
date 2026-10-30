import { currentBan } from "@/lib/employer-ban";
import type { Metadata } from "next";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { Suspense } from "react";
import Link from "next/link";
import { requestTime } from "@/components/seeker/request-time";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { listJobs } from "@/lib/data";
import { ActiveFilters } from "@/components/seeker/ActiveFilters";
import { employersOf } from "@/components/seeker/employers";
import { employerActivities } from "@/db/employer-activity";
import { FilterForm } from "@/components/seeker/FilterForm";
import { filterToQuery, isFiltered, jobsHref, parseFilter } from "@/components/seeker/filter-query";
import { JobList, JobListSkeleton } from "@/components/seeker/JobList";
import { JobBrowser } from "@/components/seeker/JobBrowser";
import { previewEmployer, previewJob } from "@/components/seeker/job-preview";
import { RememberListQuery } from "@/components/seeker/last-list";
import { FinishSaveAfterSignIn } from "@/components/seeker/SaveJobButton";
import { SaveAlert } from "@/components/seeker/SaveAlert";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { buttonClass } from "@/components/ui/Button";
import { PageTransition } from "@/components/ui/PageTransition";
import { messages, serverLang } from "@/i18n/server";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { TrackView } from "@/components/ui/TrackView";
import { JobOrder, OrderWhy } from "@/components/seeker/JobOrder";
import { jobListQuery, parseJobOrder, withJobOrder } from "@/components/seeker/job-order-query";
import { jobOrderViewer, orderJobs } from "@/lib/job-ordering.server";
import { demoDataWanted } from "@/db/ready";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await messages(seekerJobsMessages)).list.title };
}

// Round 19 sample (操作质感): this page and the job page wear the new type (`type-app`) and cards first; the other
// pages follow once the user has seen it.
export default async function JobsPage({ searchParams }: PageProps<"/[lang]/jobs">) {
  const t = (await messages(seekerJobsMessages)).list;
  return (
    <PageTransition>
      <div className={`${WIDE_ON_DESKTOP} type-app`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="text-title font-semibold">{t.heading}</h1>
          {/* Round 18 (#113): external jobs from companies' own sites, in sections of their own. */}
          <nav aria-label={t.sections} className="flex gap-2">
            <Link href="/internships" className={`${buttonClass("secondary", { pill: true })} px-3.5`}>
              {t.internships}
            </Link>
            <Link href="/professional" className={`${buttonClass("secondary", { pill: true })} px-3.5`}>
              {t.professional}
            </Link>
          </nav>
        </div>
        <NoScriptStreams />
        <FinishSaveAfterSignIn />
        <Suspense fallback={<JobListSkeleton look="app" lang={await serverLang()} />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </PageTransition>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/[lang]/jobs">, "searchParams">) {
  const params = await searchParams;
  const filter = parseFilter(params, DEFAULT_COUNTRY);
  const order = parseJobOrder(params);
  const now = await requestTime(); // the list changes as jobs are published and close
  // Recommended reads the session and saved preferences alongside the list, then orders in memory.
  const [listed, viewer] = await Promise.all([
    listJobs(filter, now),
    order === "recommended" ? jobOrderViewer(now) : null,
  ]);
  const { jobs, status } = orderJobs(listed, order, viewer);
  const [employers, activities] = await Promise.all([
    employersOf(jobs),
    employerActivities(
      jobs.map((job) => job.employerId),
      now,
    ),
  ]);
  const filtered = isFiltered(filter);
  const query = filterToQuery(filter);
  const lang = await serverLang();
  const t = (await messages(seekerJobsMessages)).list;

  // From 1024 px: the filters in a 240 px column on the left, the search box and the list (at most 720 px) on the
  // right. The form spans both columns (display: contents), so it stays one GET form. The second row takes what
  // the filter column needs beyond the first, so the search box keeps its own height above the list.
  // From 1280 px a third column previews the selected job (V6, #376; JobBrowser).
  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,48rem)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-10 xl:grid-cols-[14rem_minmax(0,1fr)_22rem] xl:gap-x-6">
      <RememberListQuery query={jobListQuery(filter, order)} />
      {/* The search funnel's first step (#319, ADR 0025): once per arrival at the list. */}
      <TrackView event={{ name: "jobs_list_view", path: "/jobs", detail: filtered ? "filtered" : "all" }} />
      <FilterForm filter={filter} order={order} />
      <JobBrowser
        jobs={jobs.map(previewJob)}
        employers={Object.fromEntries(
          [...employers].map(([id, employer]) => [id, previewEmployer(currentBan(employer, now), activities.get(id))]),
        )}
        now={now}
        demo={demoDataWanted()}
      >
        <section aria-label={t.listLabel} className="lg:col-start-2">
          <JobOrder order={order} status={status} query={query} lang={lang} />
          <ActiveFilters filter={filter} order={order} lang={lang} />
          {/* min-h-11: the row is as tall before 保存为提醒 appears (after hydration) as after, so the list stays put. */}
          <div className="mb-2 flex min-h-11 flex-wrap items-center justify-between gap-x-3">
            {status === "recommended" ? (
              <OrderWhy
                count={filtered ? t.recommendedFound(jobs.length) : t.recommendedCount(jobs.length)}
                lang={lang}
              />
            ) : (
              <p className="text-body text-muted">{filtered ? t.found(jobs.length) : t.all(jobs.length)}</p>
            )}
            <SaveAlert key={query} query={query} returnHref={jobsHref(jobListQuery(filter, order))} />
          </div>
          <JobList
            look="app"
            demo={demoDataWanted()}
            jobs={jobs}
            employers={employers}
            activities={activities}
            lang={lang}
            empty={
              filtered && (
                <Link href={jobsHref(withJobOrder("", order))} className={buttonClass("primary")}>
                  {t.clear}
                </Link>
              )
            }
          />
        </section>
      </JobBrowser>
    </div>
  );
}
