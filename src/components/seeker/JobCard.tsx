import Link from "next/link";
import type { ReactNode } from "react";
import { regionById } from "@/config/countries";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { Employer, Job } from "@/lib/types";
import { formatHours, jobTagKeys, placeName } from "@/components/seeker/format";
import { contentLang, DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { JOB_TAG_KINDS } from "@/components/ui/tag-kind";
import { SoftTag, Tag } from "@/components/ui/Tag";
import { linkCardClass } from "@/components/ui/Card";
import { Pay } from "@/components/ui/Pay";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { EmployerAvatar } from "@/components/seeker/ProfileAvatar";
import { SaveJobButton } from "@/components/seeker/SaveJobButton";
import { cardPoints, cardStatus, cardTags } from "@/components/seeker/job-card-parts";
import { FORWARD } from "@/components/ui/PageTransition";
import { EmployerActivityLine } from "@/components/seeker/EmployerActivityLine";
import type { EmployerActivity } from "@/lib/employer-activity";

/** At most this many tags on a row; the job page shows everything. */
const CARD_TAGS = 3;

/**
 * One job in a list, a block of its own (#63: rows between thin lines ran together, users could not tell where one
 * job ended): title (zh, en) with the pay on the right, then
 * 地区 and 工时 with small grey labels and how the employer is reached, then the employer (avatar, name,
 * verification level), up to three tags and 收藏 (#52). Everything else (description, shifts, languages, visas) is on the job page. Only
 * the title is a link; it stretches over the whole row, so screen readers hear the title alone.
 */
export function JobCard({
  job,
  employer,
  headingLevel = 2,
  look = "classic",
  action,
  activity,
  demo = false,
  lang = DEFAULT_LANG,
}: {
  job: Job;
  employer?: Employer;
  /** The demo site's data (demoDataWanted): 演示企业 where the verification level would be (user feedback 10-30 #2). */
  demo?: boolean;
  /** 今天在线, 通常 1 小时内回复 (#381): one line under the employer, when there is something to say. */
  activity?: EmployerActivity;
  headingLevel?: 2 | 3;
  /** The page's language (Round 20): the card renders on the server and in the browser, so it is told. */
  lang?: Lang;
  /** "app": the Round 19 sample (the job list only, until the user approves it for the other lists). */
  look?: "classic" | "app";
  /** "app" only: one more control at the end of the bottom row, e.g. 立即沟通 on an employer's page. */
  action?: ReactNode;
}) {
  if (look === "app")
    return (
      <AppJobCard
        job={job}
        employer={employer}
        headingLevel={headingLevel}
        action={action}
        activity={activity}
        demo={demo}
        lang={lang}
      />
    );
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const t = pick(seekerJobsMessages, lang);
  const region = placeName(regionById(job.country, job.regionId), lang);
  const hours = [formatEmploymentTypes(job.employmentType, lang), formatHours(job.hoursPerWeek, lang)]
    .filter(Boolean)
    .join(t.detail.clauseJoin);
  const tags = jobTagKeys(job).slice(0, CARD_TAGS);

  return (
    <article className="group relative h-full rounded-md border border-border bg-surface p-4 hover:border-brand lg:p-5 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="break-words text-subtitle font-semibold group-hover:text-brand">
            <Link
              href={`/jobs/${job.id}`}
              transitionTypes={FORWARD}
              lang={contentLang(job.titleZh)}
              className="outline-none after:absolute after:inset-0"
            >
              {job.titleZh}
            </Link>
          </Heading>
          <p lang="en" className="truncate font-latin text-meta text-muted">
            {job.titleEn}
          </p>
        </div>
        <p className="shrink-0 leading-none">
          <Pay pay={job.pay} country={job.country} lang={lang} />
        </p>
      </div>

      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body">
        {region && <Fact label={t.card.region}>{region}</Fact>}
        {hours && <Fact label={t.card.hours}>{hours}</Fact>}
        {/* How to reach the employer, before opening the job (A25). */}
        <Fact label={t.card.contact}>{job.contactPublic ? t.card.contactPublic : t.card.contactByChat}</Fact>
      </dl>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {employer && (
          <p className="flex min-w-0 items-center gap-1.5 text-body font-semibold">
            {/* Small in a row: the avatar component's own sizes are for chats and profile pages. */}
            <span className="shrink-0 *:size-7 *:text-meta">
              <EmployerAvatar employerId={employer.id} fallback={employer.name} industry={job.industry} />
            </span>
            <span lang={contentLang(employer.name)} className="truncate">
              {employer.name}
            </span>
            <span className="font-normal">
              <VerificationBadge verification={employer.verification} demo={demo} lang={lang} />
            </span>
            <EmployerActivityLine activity={activity} lang={lang} inline />
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label={t.tags.label}>
              {tags.map((tag) => (
                <li key={tag}>
                  <Tag kind={JOB_TAG_KINDS[tag]}>{t.tags[tag]}</Tag>
                </li>
              ))}
            </ul>
          )}
          <SaveJobButton jobId={job.id} title={job.titleZh} />
        </div>
      </div>
    </article>
  );
}

/**
 * The Round 19 card (操作质感, an app's feel): a white card with 16px corners and a soft shadow, no border. The title
 * and the pay lead; under them up to two light lines of points (job-card-parts.ts), one status and at most two soft tags,
 * then the employer with 收藏. The whole card opens the job (the title's link is stretched over it) and
 * gives a little when pressed; 收藏 and an `action` (立即沟通 on an employer's page) sit above the link, so
 * no button has to hang under the card.
 */
function AppJobCard({
  job,
  employer,
  headingLevel,
  action,
  activity,
  demo,
  lang,
}: {
  job: Job;
  employer?: Employer;
  headingLevel: 2 | 3;
  action?: ReactNode;
  activity?: EmployerActivity;
  demo: boolean;
  lang: Lang;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const t = pick(seekerJobsMessages, lang);
  const points = cardPoints(job, placeName(regionById(job.country, job.regionId), lang), lang);
  // The demo site's data never claims a level (user feedback 10-30 #2): 演示企业 goes by the employer's name instead.
  const found = cardStatus(job, employer);
  const status = demo && found?.kind === "verified" ? undefined : found;
  const tags = cardTags(job);

  return (
    <article
      className={`${linkCardClass()} h-full xl:has-[a[aria-current=true]]:ring-2 xl:has-[a[aria-current=true]]:ring-brand`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="line-clamp-2 text-subtitle font-semibold break-words group-hover:text-brand">
            <Link
              href={`/jobs/${job.id}`}
              transitionTypes={FORWARD}
              lang={contentLang(job.titleZh)}
              className="outline-none after:absolute after:inset-0"
            >
              {job.titleZh}
            </Link>
          </Heading>
          <p lang="en" className="truncate font-latin text-meta text-muted">
            {job.titleEn}
          </p>
        </div>
        <p className="shrink-0 leading-none">
          <Pay pay={job.pay} country={job.country} lang={lang} />
        </p>
      </div>

      {/* Up to two lines of whole points (#242, feedback 8): a point that doesn't fit goes to a third line, which is
          cut off, so nothing ends in "…" mid-word. Screen readers still read every point. */}
      <p className="mt-2 flex max-h-[2lh] flex-wrap overflow-hidden text-body text-muted">
        {points.map((point, i) => (
          <span key={point.text} className="whitespace-nowrap">
            {i > 0 && (
              <span aria-hidden="true" className="px-1.5 text-border">
                ·
              </span>
            )}
            <span lang={point.zh && contentLang(point.text)}>{point.text}</span>
          </span>
        ))}
      </p>

      {(status || tags.length > 0) && (
        <ul className="mt-2 flex flex-wrap items-center gap-1.5" aria-label={t.tags.label}>
          {status?.kind === "urgent" && (
            <li>
              <SoftTag tone="urgent">{t.tags.urgent}</SoftTag>
            </li>
          )}
          {status?.kind === "verified" && (
            <li>
              <VerificationBadge verification={status.verification} lang={lang} />
            </li>
          )}
          {tags.map((tag) => (
            <li key={tag}>
              <SoftTag tone="brand">{t.tags[tag]}</SoftTag>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        {employer && (
          <p className="flex min-w-0 items-center gap-1.5 text-body">
            <span className="shrink-0 *:size-7 *:text-meta">
              <EmployerAvatar employerId={employer.id} fallback={employer.name} industry={job.industry} />
            </span>
            <span lang={contentLang(employer.name)} className="truncate">
              {employer.name}
            </span>
            {demo && (
              <span className="shrink-0">
                <VerificationBadge verification={employer.verification} demo lang={lang} />
              </span>
            )}
            <EmployerActivityLine activity={activity} lang={lang} inline />
          </p>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <SaveJobButton jobId={job.id} title={job.titleZh} />
          {action && <div className="relative z-10 ml-1">{action}</div>}
        </div>
      </div>
    </article>
  );
}

/** A tag on a light fill, no border (Round 19). */

/** A grey label and its value, e.g. 「地区 北岸」. */
function Fact({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Loading placeholder with the block's height, so the list does not jump when it arrives. */
export function JobCardSkeleton() {
  return <div className="h-36 animate-pulse rounded-md border border-border bg-surface" />;
}
