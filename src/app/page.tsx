import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DEFAULT_COUNTRY } from "@/config/countries";
import { filterToQuery, jobsHref, parseFilter } from "@/components/seeker/filter-query";

// The job list moved to /jobs. Until the intro page lands here, send visitors on, keeping the filters
// of links shared before the move (/?industry=… → /jobs?industry=…).
export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Suspense fallback={null}>
      <ToJobs searchParams={searchParams} />
    </Suspense>
  );
}

async function ToJobs({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  redirect(jobsHref(filterToQuery(parseFilter(await searchParams, DEFAULT_COUNTRY))));
  return null;
}
