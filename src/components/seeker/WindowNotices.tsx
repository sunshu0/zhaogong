import Link from "next/link";
import { regionById } from "@/config/countries";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { Employer, Job } from "@/lib/types";
import { formatHours } from "@/components/seeker/format";
import { Pay } from "@/components/ui/Pay";
import { VerificationBadge } from "@/components/ui/VerificationBadge";

// Where each notice sits on desktop: a little out of line and turned ±2°, the third one over the other two's
// lower edges. Phones scroll them sideways instead, straight.
const PLACES = [
  "lg:left-0 lg:top-5 lg:-rotate-[2.5deg]",
  "lg:left-[16.5rem] lg:top-0 lg:z-10 lg:rotate-[1.5deg]",
  "lg:left-[7.5rem] lg:top-[10.5rem] lg:z-20 lg:-rotate-1",
];

/**
 * 橱窗告示 (Round 13): real open jobs as paper notices taped to a shop window, with a round 招 stamp and the pay
 * large. The only decoration on the site, so it is the only place with a shadow; no entrance animation.
 */
export function WindowNotices({ jobs, employers }: { jobs: Job[]; employers: Map<string, Employer> }) {
  if (jobs.length === 0) return null;
  return (
    <ul
      aria-label="正在招聘"
      data-window-notices=""
      className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-3 pb-6 lg:relative lg:mx-0 lg:block lg:h-[26rem] lg:overflow-visible lg:p-0"
    >
      {jobs.slice(0, PLACES.length).map((job, i) => (
        <li key={job.id} className={`w-[15rem] shrink-0 snap-start lg:absolute lg:w-[14.75rem] ${PLACES[i]}`}>
          <Notice job={job} employer={employers.get(job.employerId)} />
        </li>
      ))}
    </ul>
  );
}

function Notice({ job, employer }: { job: Job; employer?: Employer }) {
  const region = regionById(job.country, job.regionId)?.nameZh;
  const hours = [formatEmploymentTypes(job.employmentType), formatHours(job.hoursPerWeek)].filter(Boolean).join("，");
  return (
    <article className="group relative rounded-[2px] border border-border bg-surface px-4 pt-[1.125rem] pb-3.5 shadow-[0_1px_0_var(--border),0_10px_24px_-14px_rgba(21,33,59,0.35)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-brand">
      {/* The tape holding it to the window, and the stamp. */}
      <span
        aria-hidden="true"
        className="absolute -top-[7px] left-1/2 h-3.5 w-[3.375rem] -translate-x-1/2 -rotate-2 bg-[rgba(240,226,180,0.75)]"
      />
      <span
        aria-hidden="true"
        className="absolute top-3.5 right-3.5 grid size-[2.125rem] -rotate-12 place-items-center rounded-full border-2 border-brand text-[1.0625rem] font-black text-brand"
      >
        招
      </span>
      <h3 className="pr-10 text-title font-black group-hover:text-brand">
        <Link href={`/jobs/${job.id}`} className="outline-none after:absolute after:inset-0">
          {job.titleZh}
        </Link>
      </h3>
      <p lang="en" className="mt-0.5 truncate font-latin text-meta text-muted">
        {job.titleEn}
      </p>
      <p className="mt-3.5 leading-none">
        <Pay pay={job.pay} country={job.country} size="notice" />
      </p>
      <p className="mt-2.5 text-meta leading-relaxed text-muted">
        {region}
        {region && hours && <br />}
        {hours}
      </p>
      {employer && (
        <p className="mt-3 flex items-center justify-between gap-2 border-t border-dashed border-border pt-2.5 text-meta">
          <span className="truncate">{employer.name}</span>
          <VerificationBadge verification={employer.verification} />
        </p>
      )}
    </article>
  );
}
