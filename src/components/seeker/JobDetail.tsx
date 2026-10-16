import type { ReactNode } from "react";
import Link from "next/link";
import { regionById } from "@/config/countries";
import { INDUSTRY_LABELS, LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { Employer, Job } from "@/lib/types";
import { formatHours, jobTags, postedAgoZh } from "@/components/seeker/format";
import { expiryZh, formatDateZh, isExpired, minimumWageNote } from "@/components/seeker/job-facts";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { Tag } from "@/components/ui/Tag";
import { Pay } from "@/components/ui/Pay";
import { DescriptionTabs } from "@/components/seeker/DescriptionTabs";
import { STICKY_COLUMN } from "@/components/ui/wide";
import { EmployerAvatar } from "@/components/seeker/ProfileAvatar";
import { SaveJobButton } from "@/components/seeker/SaveJobButton";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";

/** Round 19 (操作质感): the page's blocks are cards, 16px corners and a soft shadow, no border. */
const CARD = "rounded-card bg-surface p-4 shadow-card lg:p-6";

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
  payReference,
  children,
}: {
  job: Job;
  employer?: Employer;
  now: number;
  /** Blocks for a right-hand column that stays in view from 1024 px (contact); on phones they follow the description. */
  aside?: ReactNode;
  /**
   * 立即沟通, 申请 and an icon for the contact details: a bar fixed above the bottom navigation on phones, at the
   * foot of the header from 768 px. The page sizes them: one main action, one secondary, the rest icons.
   */
  actions?: ReactNode;
  /** The share button, top right of the header. */
  share?: ReactNode;
  /** 时薪参考 (#85), right under the facts. */
  payReference?: ReactNode;
  /** Blocks shown after the description (and after `aside` on phones), e.g. report. */
  children?: ReactNode;
}) {
  const region = regionById(job.country, job.regionId);
  const payNote = minimumWageNote(job.pay, job.country);
  const tags = jobTags(job);
  const hours = [formatHours(job.hoursPerWeek), job.shiftsZh].filter(Boolean).join("，");

  const details = (
    <>
      {isExpired(job, now) && (
        <p className="rounded-control bg-warn-soft px-3 py-2 text-body text-warn">这个职位已截止，可能已经招满。</p>
      )}

      {/* The title and the pay lead (Round 19); the facts follow in a card of their own. */}
      <header className={CARD}>
        <div className="flex items-start justify-between gap-2">
          {tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label="标签">
              {tags.map((tag) => (
                <li key={tag}>
                  <Tag>{tag}</Tag>
                </li>
              ))}
            </ul>
          ) : (
            <span />
          )}
          <div className="-mt-1 -mr-1 flex shrink-0 items-center gap-1">
            <SaveJobButton jobId={job.id} title={job.titleZh} />
            {share}
          </div>
        </div>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-black break-words lg:text-[2.125rem]">{job.titleZh}</h1>
        <p lang="en" className="font-latin text-body text-muted">
          {job.titleEn}
        </p>
        <p className="mt-3">
          <Pay pay={job.pay} country={job.country} size="detail" />
        </p>
        {payNote && (
          <p className={`mt-3 rounded-control px-3 py-2 text-body ${NOTE_STYLES[payNote.level]}`}>{payNote.text}</p>
        )}

        {actions && (
          <div className="fixed inset-x-0 bottom-above-nav z-10 flex items-center gap-2 bg-surface/90 px-4 py-3 shadow-[0_-1px_0_var(--border)] backdrop-blur-md md:static md:z-auto md:mt-5 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none">
            {actions}
          </div>
        )}
      </header>

      <section aria-label="职位信息" className={CARD}>
        {/* The facts both sides need first (A29): 2 columns on phones, 3 from 1024 px. */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3">
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
        <p className="mt-4 border-t border-border pt-3 text-meta text-muted">
          工作语言：{job.languages.length ? job.languages.map((l) => LANGUAGE_LABELS[l].zh).join("、") : "未注明"}
          。签证一项是雇主提供的信息，不构成签证或移民建议。
        </p>
        <p className="mt-1 text-meta text-muted">
          {formatDateZh(job.postedAt, job.country)}发布（{postedAgoZh(job.postedAt, now)}）·{" "}
          {expiryZh(job.expiresAt, now, job.country)}
        </p>
      </section>

      {payReference}

      {employer && (
        <section aria-label="雇主" className={CARD}>
          <p className="flex min-w-0 items-center gap-2 font-medium">
            <EmployerAvatar employerId={employer.id} fallback={employer.name} />
            <span className="break-words">{employer.name}</span>
          </p>
          <div className="mt-2">
            <VerificationBadge verification={employer.verification} explain />
          </div>
          <Link
            href={`/employers/${employer.id}`}
            className="pressable mt-1 inline-flex min-h-11 items-center text-body font-medium text-brand"
          >
            查看雇主主页 →
          </Link>
        </section>
      )}

      <DescriptionTabs zh={job.descriptionZh} en={job.descriptionEn} />
    </>
  );

  // On phones the action bar is fixed above the bottom navigation; leave room for it at the end of the page.
  const room = actions ? "pb-24 md:pb-0" : "";
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
      <dd className="mt-0.5 text-body font-medium break-words">{children}</dd>
    </div>
  );
}

export function JobDetailSkeleton() {
  return (
    <div data-nojs-hide="">
      <DetailPageSkeleton />
    </div>
  );
}
