import type { ReactNode } from "react";
import Link from "next/link";
import { regionById } from "@/config/countries";
import { INDUSTRY_LABELS, LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { Employer, Job } from "@/lib/types";
import { formatHours, formatPay, jobTags, postedAgoZh } from "@/components/seeker/format";
import { expiryZh, formatDateZh, isExpired, minimumWageNote } from "@/components/seeker/job-facts";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { Tag } from "@/components/ui/Tag";
import { PAY_TEXT } from "@/components/ui/text";
import { DescriptionTabs } from "@/components/seeker/DescriptionTabs";
import { STICKY_COLUMN } from "@/components/ui/wide";
import { EmployerAvatar } from "@/components/seeker/ProfileAvatar";

const NOTE_STYLES = {
  below: "bg-danger-soft text-danger",
  at: "bg-warn-soft text-warn",
  near: "bg-warn-soft text-warn",
};

export function JobDetail({
  job,
  employer,
  now,
  aside,
  actions,
  share,
  children,
}: {
  job: Job;
  employer?: Employer;
  now: number;
  /** Blocks for a right-hand column that stays in view from 1024 px (contact); on phones they follow the description. */
  aside?: ReactNode;
  /** 立即沟通 and the like: a bar fixed above the bottom navigation on phones, under the facts from 768 px. */
  actions?: ReactNode;
  /** The share button, top right of the header. */
  share?: ReactNode;
  /** Blocks shown after the description (and after `aside` on phones), e.g. report. */
  children?: ReactNode;
}) {
  const region = regionById(job.country, job.regionId);
  const payNote = minimumWageNote(job.pay, job.country);
  const tags = jobTags(job);
  const [amount, unit] = formatPay(job.pay, job.country).split("/");
  const hours = [formatHours(job.hoursPerWeek), job.shiftsZh].filter(Boolean).join("，");

  const details = (
    <>
      {isExpired(job, now) && (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">这个职位已截止，可能已经招满。</p>
      )}

      <header className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-title font-semibold break-words">{job.titleZh}</h1>
            <p lang="en" className="text-body text-muted">
              {job.titleEn}
            </p>
          </div>
          {share}
        </div>
        {tags.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="标签">
            {tags.map((tag) => (
              <li key={tag}>
                <Tag>{tag}</Tag>
              </li>
            ))}
          </ul>
        )}

        {/* The facts both sides need first (A29): 2 columns on phones, 3 from 1024 px. */}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 lg:grid-cols-3">
          <Fact term="薪资">
            <span className={PAY_TEXT.detail}>{amount}</span>
            {unit && <span className="text-body text-muted">/{unit}</span>}
          </Fact>
          <Fact term="地区">
            {region?.nameZh}
            {job.address && <span className="block text-meta text-muted">{job.address}</span>}
          </Fact>
          <Fact term="工时和班次">{hours || "未注明"}</Fact>
          <Fact term="用工形式">
            {formatEmploymentTypes(job.employmentType)}
            <span className="block text-meta text-muted">{INDUSTRY_LABELS[job.industry].zh}</span>
          </Fact>
          <Fact term="食宿">
            {job.mealsIncluded ? "包餐" : "不包餐"} · {job.accommodationIncluded ? "包住" : "不包住"}
          </Fact>
          <Fact term="接受的签证">
            {job.visaAccepted.length ? job.visaAccepted.map((v) => VISA_LABELS[v].zh).join("、") : "未注明"}
          </Fact>
        </dl>
        {payNote && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${NOTE_STYLES[payNote.level]}`}>{payNote.text}</p>}
        <p className="mt-3 text-meta text-muted">
          工作语言：{job.languages.length ? job.languages.map((l) => LANGUAGE_LABELS[l].zh).join("、") : "未注明"}
          。签证一项是雇主提供的信息，不构成签证或移民建议。
        </p>
        <p className="mt-1 text-meta text-muted">
          {formatDateZh(job.postedAt, job.country)}发布（{postedAgoZh(job.postedAt, now)}）·{" "}
          {expiryZh(job.expiresAt, now, job.country)}
        </p>

        {actions && (
          <div className="fixed inset-x-0 bottom-above-nav z-10 flex items-center gap-2 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur *:flex-1 md:static md:z-auto md:mt-4 md:flex-none md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none md:*:flex-none">
            {actions}
          </div>
        )}
      </header>

      {employer && (
        <section aria-label="雇主" className="rounded-xl border border-border bg-surface p-4">
          <p className="flex min-w-0 items-center gap-2 font-medium">
            <EmployerAvatar employerId={employer.id} fallback={employer.name} />
            <span className="break-words">{employer.name}</span>
          </p>
          <div className="mt-2">
            <VerificationBadge verification={employer.verification} explain />
          </div>
          <Link
            href={`/employers/${employer.id}`}
            className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-brand"
          >
            查看雇主主页 →
          </Link>
        </section>
      )}

      <DescriptionTabs zh={job.descriptionZh} en={job.descriptionEn} />
    </>
  );

  // On phones the action bar is fixed above the bottom navigation; leave room for it at the end of the page.
  const room = actions ? "pb-20 md:pb-0" : "";
  if (!aside) {
    return (
      <article className={`space-y-3 ${room}`}>
        {details}
        {children}
      </article>
    );
  }

  return (
    <article
      className={`space-y-3 ${room} lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-x-6 lg:gap-y-3 lg:space-y-0`}
    >
      <div className="space-y-3 lg:col-start-1">{details}</div>
      <aside aria-label="联系雇主" className={`space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 ${STICKY_COLUMN}`}>
        {aside}
      </aside>
      {children && <div className="space-y-3 lg:col-start-1">{children}</div>}
    </article>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-muted">{term}</dt>
      <dd className="mt-0.5 text-body break-words">{children}</dd>
    </div>
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
