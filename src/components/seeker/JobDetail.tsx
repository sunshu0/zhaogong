import type { ReactNode } from "react";
import Link from "next/link";
import { regionById } from "@/config/countries";
import { INDUSTRY_LABELS, LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { Employer, Job } from "@/lib/types";
import { formatHours, jobTagKeys, placeName, postedAgo } from "@/components/seeker/format";
import { expiry, formatJobDate, isExpired, minimumWageNote } from "@/components/seeker/job-facts";
import { contentLang, DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { JOB_TAG_KINDS } from "@/components/ui/tag-kind";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { Tag } from "@/components/ui/Tag";
import { Pay } from "@/components/ui/Pay";
import { DescriptionTabs } from "@/components/seeker/DescriptionTabs";
import { STICKY_COLUMN } from "@/components/ui/wide";
import { EmployerAvatar } from "@/components/seeker/ProfileAvatar";
import { SaveJobButton } from "@/components/seeker/SaveJobButton";
import { DetailPageSkeleton } from "@/components/ui/Skeleton";
import { FORWARD } from "@/components/ui/PageTransition";

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
  lang = DEFAULT_LANG,
}: {
  job: Job;
  employer?: Employer;
  now: number;
  /** Blocks for a right-hand column that stays in view from 1024 px (contact); on phones they follow the description. */
  aside?: ReactNode;
  /**
   * 立即沟通 and an icon for the contact details: a bar fixed above the bottom navigation on phones, at the
   * foot of the header from 768 px. The page sizes them: one main action, the rest icons.
   */
  actions?: ReactNode;
  /** The share button, top right of the header. */
  share?: ReactNode;
  /** 时薪参考 (#85), right under the facts. */
  payReference?: ReactNode;
  /** Blocks shown after the description (and after `aside` on phones), e.g. report. */
  children?: ReactNode;
  /** The page's language (Round 20): the job page renders on the server, the post form's preview in the browser. */
  lang?: Lang;
}) {
  const t = pick(seekerJobsMessages, lang);
  const region = regionById(job.country, job.regionId);
  const payNote = minimumWageNote(job.pay, job.country, lang);
  const tags = jobTagKeys(job);
  const hours = formatHours(job.hoursPerWeek, lang);
  const shifts = job.shiftsZh?.trim();
  const join = (items: string[]) => items.join(t.detail.listJoin);

  const details = (
    <>
      {isExpired(job, now) && (
        <p className="rounded-control bg-warn-soft px-3 py-2 text-body text-warn">{t.closes.closedNote}</p>
      )}

      {/* The title and the pay lead (Round 19); the facts follow in a card of their own. */}
      <header className={CARD}>
        <div className="flex items-start justify-between gap-2">
          {tags.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5" aria-label={t.tags.label}>
              {tags.map((tag) => (
                <li key={tag}>
                  <Tag kind={JOB_TAG_KINDS[tag]}>{t.tags[tag]}</Tag>
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
        <h1
          lang={contentLang(job.titleZh)}
          className="mt-1 text-[1.75rem] leading-tight font-black break-words lg:text-[2.125rem]"
        >
          {job.titleZh}
        </h1>
        <p lang="en" className="font-latin text-body text-muted">
          {job.titleEn}
        </p>
        <p className="mt-3">
          <Pay pay={job.pay} country={job.country} size="detail" lang={lang} />
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

      <section aria-label={t.detail.facts} className={CARD}>
        {/* The facts both sides need first (A29): 2 columns on phones, 3 from 1024 px. */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-3">
          <Fact term={t.detail.region}>
            {placeName(region, lang)}
            {job.address && <span className="block text-meta text-muted">{job.address}</span>}
          </Fact>
          <Fact term={t.detail.hoursAndShifts}>
            {hours || shifts ? (
              <>
                {hours}
                {hours && shifts && t.detail.clauseJoin}
                {shifts && <span lang={contentLang(shifts)}>{shifts}</span>}
              </>
            ) : (
              t.detail.notStated
            )}
          </Fact>
          <Fact term={t.detail.employmentType}>
            {formatEmploymentTypes(job.employmentType, lang)}
            <span className="block text-meta text-muted">{INDUSTRY_LABELS[job.industry][lang]}</span>
          </Fact>
          <Fact term={t.detail.food}>
            {job.mealsIncluded ? t.detail.meals : t.detail.noMeals} ·{" "}
            {job.accommodationIncluded ? t.detail.housing : t.detail.noHousing}
          </Fact>
          <Fact term={t.detail.visas}>
            {job.visaAccepted.length ? join(job.visaAccepted.map((v) => VISA_LABELS[v][lang])) : t.detail.notStated}
          </Fact>
        </dl>
        <p className="mt-4 border-t border-border pt-3 text-meta text-muted">
          {t.detail.languages(
            job.languages.length ? join(job.languages.map((l) => LANGUAGE_LABELS[l][lang])) : t.detail.notStated,
          )}
          {t.detail.visaNote}
        </p>
        <p className="mt-1 text-meta text-muted">
          {t.posted.on(formatJobDate(job.postedAt, job.country, lang), postedAgo(job.postedAt, now, lang))} ·{" "}
          {expiry(job.expiresAt, now, job.country, lang)}
        </p>
      </section>

      {payReference}

      {employer && (
        <section aria-label={t.detail.employer} className={CARD}>
          <p className="flex min-w-0 items-center gap-2 font-medium">
            <EmployerAvatar employerId={employer.id} fallback={employer.name} industry={job.industry} />
            <span lang={contentLang(employer.name)} className="break-words">
              {employer.name}
            </span>
          </p>
          <div className="mt-2">
            <VerificationBadge verification={employer.verification} explain lang={lang} />
          </div>
          <Link
            href={`/employers/${employer.id}`}
            transitionTypes={FORWARD}
            className="pressable mt-1 inline-flex min-h-11 items-center text-body font-medium text-brand"
          >
            {t.detail.employerPage}
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
      <aside
        aria-label={t.detail.contactEmployer}
        className={`space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 ${STICKY_COLUMN}`}
      >
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
