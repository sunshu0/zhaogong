import Link from "next/link";
import { regionById } from "@/config/countries";
import { EMPLOYMENT_TYPE_LABELS } from "@/i18n/labels";
import type { Employer, Job } from "@/lib/types";
import { formatHours, formatPay, jobTags, postedAgoZh } from "@/components/seeker/format";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

export function JobCard({ job, employer, now }: { job: Job; employer?: Employer; now: number }) {
  const facts = [
    regionById(job.country, job.regionId)?.nameZh,
    EMPLOYMENT_TYPE_LABELS[job.employmentType].zh,
    formatHours(job.hoursPerWeek),
  ].filter(Boolean);

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-brand/40 active:bg-background"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold leading-snug">{job.titleZh}</h2>
          <p className="truncate text-xs text-muted">{job.titleEn}</p>
        </div>
        <p className="shrink-0 text-base font-semibold text-brand">{formatPay(job.pay, job.country)}</p>
      </div>

      {employer && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span>{employer.name}</span>
          <VerificationBadge verification={employer.verification} />
        </p>
      )}

      <p className="mt-1 flex flex-wrap gap-x-1.5 text-sm text-muted">
        {facts.map((fact, i) => (
          <span key={fact} className="whitespace-nowrap">
            {i > 0 && <span aria-hidden="true">· </span>}
            {fact}
          </span>
        ))}
      </p>

      <div className="mt-3 flex items-end justify-between gap-3">
        <ul className="flex flex-wrap gap-1.5">
          {jobTags(job).map((tag) => (
            <li
              key={tag}
              className={`rounded px-1.5 py-0.5 text-xs ${tag === "急招" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand"}`}
            >
              {tag}
            </li>
          ))}
        </ul>
        <span className="shrink-0 text-xs text-muted">{postedAgoZh(job.postedAt, now)}</span>
      </div>
    </Link>
  );
}
