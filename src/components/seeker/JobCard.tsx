import Link from "next/link";
import { regionById } from "@/config/countries";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { INDUSTRY_LABELS, LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import type { Employer, Job } from "@/lib/types";
import { formatHours, formatPay, jobTags, postedAgoZh } from "@/components/seeker/format";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";
import { EmployerJobActivity } from "@/components/seeker/ChatActivity";
import { EmployerAvatar } from "@/components/seeker/ProfileAvatar";

export function JobCard({ job, employer, now }: { job: Job; employer?: Employer; now: number }) {
  const facts = [
    regionById(job.country, job.regionId)?.nameZh,
    formatEmploymentTypes(job.employmentType),
    formatHours(job.hoursPerWeek),
    INDUSTRY_LABELS[job.industry].zh,
  ].filter(Boolean);
  const details = [
    ["班次", job.shiftsZh || "未注明"],
    ["工作语言", job.languages.map((language) => LANGUAGE_LABELS[language].zh).join("、") || "未注明"],
    ["雇主接受的签证", job.visaAccepted.map((visa) => VISA_LABELS[visa].zh).join("、") || "未注明"],
  ];

  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block h-full rounded-lg border border-border bg-surface p-4 transition-colors hover:border-brand/40 active:bg-background sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold leading-snug group-hover:text-brand">{job.titleZh}</h2>
          <p className="mt-1 break-words text-xs text-muted">{job.titleEn}</p>
        </div>
        <p className="break-words text-lg font-semibold text-brand">{formatPay(job.pay, job.country)}</p>
      </div>

      {employer && (
        <div className="mt-2">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <EmployerAvatar employerId={employer.id} fallback={employer.name} />
          <span>{employer.name}</span>
          <VerificationBadge verification={employer.verification} />
          <span className="text-xs text-muted">雇主ID：{employer.id}</span>
          </p>
          <EmployerJobActivity employerId={employer.id} />
        </div>
      )}

      <p className="mt-1 flex flex-wrap gap-x-1.5 text-sm text-muted">
        {facts.map((fact, i) => (
          <span key={fact}>
            {i > 0 && <span aria-hidden="true">· </span>}
            {fact}
          </span>
        ))}
      </p>

      <p className="mt-3 line-clamp-2 whitespace-pre-line break-words text-sm leading-relaxed">{job.descriptionZh}</p>

      <dl className="mt-3 grid gap-x-6 gap-y-2 border-t border-border pt-3 text-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)]">
        {details.map(([term, value]) => <div key={term} className="min-w-0"><dt className="text-xs text-muted">{term}</dt><dd className="mt-1 break-words">{value}</dd></div>)}
      </dl>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
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
