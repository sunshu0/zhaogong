import { Suspense } from "react";
import Link from "next/link";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { getEmployer, listJobs } from "@/lib/data";
import type { Employer, Job } from "@/lib/types";
import { ActiveFilters } from "@/components/seeker/ActiveFilters";
import { FilterForm } from "@/components/seeker/FilterForm";
import { filterToQuery, isFiltered, parseFilter } from "@/components/seeker/filter-query";
import { JobList, JobListSkeleton } from "@/components/seeker/JobList";
import { RememberListQuery } from "@/components/seeker/last-list";
import { requestTime } from "@/components/seeker/request-time";
import { STICKY_COLUMN, WIDE_ON_DESKTOP } from "@/components/ui/wide";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className={WIDE_ON_DESKTOP}>
      <h1 className="mb-3 text-lg font-semibold">奥克兰中文工作</h1>
      <Suspense fallback={<JobListSkeleton />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Results({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const filter = parseFilter(await searchParams, DEFAULT_COUNTRY);
  const now = await requestTime();
  const jobs = await listJobs(filter);
  const employers = await employersOf(jobs);
  const filtered = isFiltered(filter);
  const query = filterToQuery(filter);

  return (
    // From 1024 px: filters in a left column that stays in view, results on the right.
    <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-6">
      <RememberListQuery query={query} />
      <aside aria-label="筛选职位" className={STICKY_COLUMN}>
        <FilterForm key={query} filter={filter} />
      </aside>
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
              <Link href="/" className="inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
                清除筛选，看全部职位
              </Link>
            )
          }
        />
      </section>
    </div>
  );
}

async function employersOf(jobs: Job[]): Promise<Map<string, Employer>> {
  const ids = [...new Set(jobs.map((j) => j.employerId))];
  const found = await Promise.all(ids.map((id) => getEmployer(id)));
  return new Map(found.filter((e): e is Employer => e != null).map((e) => [e.id, e]));
}
