import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { listJobs } from "@/lib/data";
import { ActiveFilters } from "@/components/seeker/ActiveFilters";
import { employersOf } from "@/components/seeker/employers";
import { FilterForm } from "@/components/seeker/FilterForm";
import { filterToQuery, isFiltered, jobsHref, parseFilter } from "@/components/seeker/filter-query";
import { JobList, JobListSkeleton } from "@/components/seeker/JobList";
import { RememberListQuery } from "@/components/seeker/last-list";
import { requestTime } from "@/components/seeker/request-time";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";

export const metadata: Metadata = { title: "奥克兰中文工作" };

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
  return (
    <div className={WIDE_ON_DESKTOP}>
      <h1 className="mb-3 text-lg font-semibold">奥克兰中文工作</h1>
      <Suspense fallback={<JobListSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/jobs">, "searchParams">) {
  const filter = parseFilter(await searchParams, DEFAULT_COUNTRY);
  const now = await requestTime();
  const jobs = await listJobs(filter);
  const employers = await employersOf(jobs);
  const filtered = isFiltered(filter);
  const query = filterToQuery(filter);

  return (
    <>
      <RememberListQuery query={query} />
      <FilterForm key={query} filter={filter} />
      <section aria-label="职位列表">
        <ActiveFilters filter={filter} />
        <p className="mb-3 text-sm text-muted">
          {filtered ? `找到 ${jobs.length} 个职位` : `共 ${jobs.length} 个职位，最新发布在前`}
        </p>
        <JobList
          jobs={jobs}
          employers={employers}
          now={now}
          empty={
            filtered && (
              <Link
                href={jobsHref("")}
                className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
              >
                清除筛选，看全部职位
              </Link>
            )
          }
        />
      </section>
    </>
  );
}
