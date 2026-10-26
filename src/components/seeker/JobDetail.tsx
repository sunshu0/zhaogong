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
import { EmployerActivityLine } from "@/components/seeker/EmployerActivityLine";
import type { EmployerActivity } from "@/lib/employer-activity";

/**
 * V2 (#376): the job is one sheet, its parts split by thin lines; only what opens something is a card (shadow).
 */
const SHEET = "divide-y divide-border overflow-hidden rounded-card bg-surface ring-1 ring-border";
/** A part of the sheet. */
const SHEET_PART = "p-4 lg:px-7 lg:py-5";
/** A card of its own: the employer, in the right column from 1024 px. */
const CARD = "rounded-card bg-surface p-4 shadow-card lg:p-5";

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
  activity,
  lang = DEFAULT_LANG,
}: {
  job: Job;
  employer?: Employer;
  /** 今天在线, 通常 1 小时内回复 (#381): one line under the employer's name, when there is something to say. */
  activity?: EmployerActivity;
  now: number;
  /**
   * Blocks for the right-hand column that stays in view from 1024 px (contact), under the pay and `actions`; on
   * phones they follow the description.
   */
  aside?: ReactNode;
  /**
   * 立即沟通 and an icon for the contact details: a bar fixed above the bottom navigation below 1024 px, under
   * the pay at the top of the right-hand column from 1024 px (#376). The page sizes them: one main action, the
   * rest icons.
   */
  actions?: ReactNode;
  /** The share button, top right of the header. */
  share?: ReactNode;
  /** 时薪参考 (#85), right under the facts: a part of the sheet (PayReferenceBox look="sheet"). */
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

  const expired = isExpired(job, now) && (
    <p className="rounded-control bg-warn-soft px-3 py-2 text-body text-warn">{t.closes.closedNote}</p>
  );

  // The employer: name, verification and a link to its page. Rendered in the sheet on phones and as a card in the
  // right-hand column from 1024 px; CSS shows one, so screen readers meet it once.
  const employerCard = employer && (
    <section aria-label={t.detail.employer}>
      <p className="flex min-w-0 items-center gap-2 font-medium">
        <EmployerAvatar employerId={employer.id} fallback={employer.name} industry={job.industry} />
        <span lang={contentLang(employer.name)} className="break-words">
          {employer.name}
        </span>
      </p>
      <EmployerActivityLine activity={activity} lang={lang} className="mt-1" />
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
  );

  const details = (
    <>
      {/* The title and the pay lead (Round 19); the facts follow, then the pay reference and the description. */}
      <header className={SHEET_PART}>
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
            {/* T8 (#405): on a phone 收藏 is in the fixed bar with the page's actions, when it has them. */}
            <SaveJobButton jobId={job.id} title={job.titleZh} className={actions ? "max-lg:hidden" : ""} />
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
      </header>

      {/* On phones the employer follows the title (V8); from 1024 px it is a card in the right-hand column. */}
      {employerCard && <div className={`${SHEET_PART} ${aside || actions ? "lg:hidden" : ""}`}>{employerCard}</div>}

      <section aria-label={t.detail.facts} className={SHEET_PART}>
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

      <DescriptionTabs zh={job.descriptionZh} en={job.descriptionEn} plain />
    </>
  );

  // Below 1024 px the action bar is fixed above the bottom navigation; leave room for it at the end of the page.
  const room = actions ? "pb-24 lg:pb-0" : "";
  if (!aside && !actions) {
    return (
      <article className={`space-y-3 ${room}`}>
        {expired}
        <div className={SHEET}>{details}</div>
        {children}
      </article>
    );
  }

  return (
    <article
      className={`space-y-3 ${room} lg:grid lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:items-start lg:gap-x-6 lg:gap-y-3 lg:space-y-0`}
    >
      <div className="space-y-3 lg:col-start-1">
        {expired}
        <div className={SHEET}>{details}</div>
      </div>
      <aside
        aria-label={t.detail.contactEmployer}
        className={`space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 ${STICKY_COLUMN}`}
      >
        {actions && (
          // The pay again with the main action from 1024 px (V8's action card); below, only the fixed bar shows.
          <div className="lg:space-y-4 lg:rounded-card lg:bg-surface lg:p-5 lg:ring-1 lg:ring-border">
            <p aria-hidden="true" className="hidden leading-none lg:block">
              <Pay pay={job.pay} country={job.country} size="card" lang={lang} />
            </p>
            <div className="fixed inset-x-0 bottom-above-nav z-10 flex items-center gap-2 bg-surface/90 px-4 py-3 shadow-[0_-1px_0_var(--border)] backdrop-blur-md lg:static lg:z-auto lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
              {actions}
            </div>
          </div>
        )}
        {aside}
        {employerCard && <div className={`hidden lg:block ${CARD}`}>{employerCard}</div>}
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
