import type { Metadata } from "next";
import { NoScriptStreams } from "@/components/seeker/NoScriptStreams";
import { Suspense } from "react";
import Link from "next/link";
import { requestTime } from "@/components/seeker/request-time";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { listJobs } from "@/lib/data";
import { ActiveFilters } from "@/components/seeker/ActiveFilters";
import { employersOf } from "@/components/seeker/employers";
import { FilterForm } from "@/components/seeker/FilterForm";
import { filterToQuery, isFiltered, jobsHref, parseFilter } from "@/components/seeker/filter-query";
import { JobList, JobListSkeleton } from "@/components/seeker/JobList";
import { RememberListQuery } from "@/components/seeker/last-list";
import { FinishSaveAfterSignIn } from "@/components/seeker/SaveJobButton";
import { SaveAlert } from "@/components/seeker/SaveAlert";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { buttonClass } from "@/components/ui/Button";
import { PageTransition } from "@/components/ui/PageTransition";

export const metadata: Metadata = { title: "奥克兰中文工作" };

// Round 19 sample (操作质感): this page and the job page wear the new type (`type-app`) and cards first; the other
// pages follow once the user has seen it.
export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
  return (
    <PageTransition>
      <div className={`${WIDE_ON_DESKTOP} type-app`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1 className="text-title font-semibold">奥克兰中文工作</h1>
          {/* Round 18 (#113): external jobs from companies' own sites, in sections of their own. */}
          <nav aria-label="外部职位分区" className="flex gap-2">
            <Link href="/internships" className={`${buttonClass("secondary", { pill: true })} min-h-9 px-3.5`}>
              实习
            </Link>
            <Link href="/professional" className={`${buttonClass("secondary", { pill: true })} min-h-9 px-3.5`}>
              专业职位
            </Link>
          </nav>
        </div>
        <NoScriptStreams />
        <FinishSaveAfterSignIn />
        <Suspense fallback={<JobListSkeleton look="app" />}>
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </PageTransition>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/jobs">, "searchParams">) {
  const filter = parseFilter(await searchParams, DEFAULT_COUNTRY);
  const now = await requestTime(); // the list changes as jobs are published and close
  const jobs = await listJobs(filter, now);
  const employers = await employersOf(jobs);
  const filtered = isFiltered(filter);
  const query = filterToQuery(filter);

  // From 1024 px: the filters in a 240 px column on the left, the search box and the list (at most 720 px) on the
  // right. The form spans both columns (display: contents), so it stays one GET form. The second row takes what
  // the filter column needs beyond the first, so the search box keeps its own height above the list.
  return (
    <div className="lg:grid lg:grid-cols-[16rem_minmax(0,48rem)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-10">
      <RememberListQuery query={query} />
      <FilterForm filter={filter} />
      <section aria-label="职位列表" className="lg:col-start-2">
        <ActiveFilters filter={filter} />
        {/* min-h-11: the row is as tall before 保存为提醒 appears (after hydration) as after, so the list stays put. */}
        <div className="mb-2 flex min-h-11 flex-wrap items-center justify-between gap-x-3">
          <p className="text-body text-muted">
            {filtered ? `找到 ${jobs.length} 个职位` : `共 ${jobs.length} 个职位，最新发布在前`}
          </p>
          <SaveAlert key={query} query={query} />
        </div>
        <JobList
          look="app"
          jobs={jobs}
          employers={employers}
          empty={
            filtered && (
              <Link href={jobsHref("")} className={buttonClass("primary")}>
                清除筛选，看全部职位
              </Link>
            )
          }
        />
      </section>
    </div>
  );
}
