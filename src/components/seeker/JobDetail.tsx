import type { ReactNode } from "react";
import { COUNTRIES, regionById } from "@/config/countries";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS, LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import type { Employer, Job } from "@/lib/types";
import { formatHours, formatPay, jobTags, postedAgoZh } from "@/components/seeker/format";
import { expiryZh, formatDateZh, isExpired, minimumWageNote, verificationNote } from "@/components/seeker/job-facts";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

const NOTE_STYLES = {
  below: "bg-danger-soft text-danger",
  at: "bg-warn-soft text-warn",
  near: "bg-warn-soft text-warn",
};

export function JobDetail({
  job,
  employer,
  now,
  children,
}: {
  job: Job;
  employer?: Employer;
  now: number;
  /** Contact, report and share blocks, shown after the description. */
  children?: ReactNode;
}) {
  const region = regionById(job.country, job.regionId);
  const payNote = minimumWageNote(job.pay, job.country);
  const tags = jobTags(job);
  const hours = [formatHours(job.hoursPerWeek), job.shiftsZh].filter(Boolean).join("，");

  return (
    <article className="space-y-3">
      {isExpired(job, now) && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">这个职位已截止，可能已经招满。</p>
      )}

      <header className="rounded-xl border border-border bg-surface p-4">
        <h1 className="text-xl leading-snug font-semibold">{job.titleZh}</h1>
        <p lang="en" className="text-sm text-muted">
          {job.titleEn}
        </p>
        <p className="mt-3 text-2xl font-semibold text-brand">{formatPay(job.pay, job.country)}</p>
        {payNote && <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${NOTE_STYLES[payNote.level]}`}>{payNote.text}</p>}
        {tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <li
                key={tag}
                className={`rounded px-1.5 py-0.5 text-xs ${tag === "急招" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand"}`}
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">
          {formatDateZh(job.postedAt, job.country)}发布（{postedAgoZh(job.postedAt, now)}）· {expiryZh(job.expiresAt, now, job.country)}
        </p>
      </header>

      {employer && (
        <section aria-label="雇主" className="rounded-xl border border-border bg-surface p-4">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {employer.name}
            <VerificationBadge verification={employer.verification} />
          </p>
          <p className="mt-1 text-sm text-muted">{verificationNote(employer.verification, job.country)}</p>
          {employer.legalName && (
            <p className="mt-1 text-xs text-muted">
              {employer.legalName}
              {employer.businessNumber && ` · ${COUNTRIES[job.country].businessNumberLabel} ${employer.businessNumber}`}
            </p>
          )}
        </section>
      )}

      <section aria-label="工作信息" className="rounded-xl border border-border bg-surface p-4">
        <dl className="grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2.5 text-sm">
          <Fact term="地区">
            {region?.nameZh}
            {job.address && <span className="text-muted">，{job.address}</span>}
          </Fact>
          <Fact term="工作类型">
            {EMPLOYMENT_TYPE_LABELS[job.employmentType].zh} · {INDUSTRY_LABELS[job.industry].zh}
          </Fact>
          {hours && <Fact term="工时">{hours}</Fact>}
          <Fact term="食宿">
            {job.mealsIncluded ? "包餐" : "不包餐"} · {job.accommodationIncluded ? "包住" : "不包住"}
          </Fact>
          <Fact term="工作语言">
            {job.languages.length ? job.languages.map((l) => LANGUAGE_LABELS[l].zh).join("、") : "未注明"}
          </Fact>
          <Fact term="签证">
            <span className="text-muted">雇主注明可接受：</span>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {job.visaAccepted.map((v) => (
                <li key={v} className="rounded border border-border px-1.5 py-0.5 text-xs">
                  {VISA_LABELS[v].zh}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs text-muted">以上为雇主提供的信息，不构成签证或移民建议。</p>
          </Fact>
        </dl>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 font-medium">职位描述</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line">{job.descriptionZh}</p>
        </section>
        <section lang="en" className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 font-medium">Job description</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line">{job.descriptionEn}</p>
        </section>
      </div>

      {children}
    </article>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{term}</dt>
      <dd>{children}</dd>
    </>
  );
}

export function JobDetailSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-44 animate-pulse rounded-xl border border-border bg-surface" />
      <div className="h-20 animate-pulse rounded-xl border border-border bg-surface" />
      <div className="h-56 animate-pulse rounded-xl border border-border bg-surface" />
    </div>
  );
}
