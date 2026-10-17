import Link from "next/link";
import type { ReactNode } from "react";
import { regionById } from "@/config/countries";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { Employer, Job } from "@/lib/types";
import { formatHours, jobTags } from "@/components/seeker/format";
import { SoftTag, Tag } from "@/components/ui/Tag";
import { linkCardClass } from "@/components/ui/Card";
import { Pay } from "@/components/ui/Pay";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { EmployerAvatar } from "@/components/seeker/ProfileAvatar";
import { SaveJobButton } from "@/components/seeker/SaveJobButton";
import { ApplyRowButton } from "@/components/seeker/ApplyJob";
import { cardPoints, cardStatus, cardTags } from "@/components/seeker/job-card-parts";
import { FORWARD } from "@/components/ui/PageTransition";

/** At most this many tags on a row; the job page shows everything. */
const CARD_TAGS = 3;

/**
 * One job in a list, a block of its own (#63: rows between thin lines ran together, users could not tell where one
 * job ended): title (zh, en) with the pay on the right, then
 * 地区 and 工时 with small grey labels and how the employer is reached, then the employer (avatar, name,
 * verification level), up to three tags, 收藏 (#52) and 申请 (#84). Everything else (description, shifts, languages, visas) is on the job page. Only
 * the title is a link; it stretches over the whole row, so screen readers hear the title alone.
 */
export function JobCard({
  job,
  employer,
  headingLevel = 2,
  look = "classic",
  action,
}: {
  job: Job;
  employer?: Employer;
  headingLevel?: 2 | 3;
  /** "app": the Round 19 sample (the job list only, until the user approves it for the other lists). */
  look?: "classic" | "app";
  /** "app" only: one more control at the end of the bottom row, e.g. 立即沟通 on an employer's page. */
  action?: ReactNode;
}) {
  if (look === "app") return <AppJobCard job={job} employer={employer} headingLevel={headingLevel} action={action} />;
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const region = regionById(job.country, job.regionId)?.nameZh;
  const hours = [formatEmploymentTypes(job.employmentType), formatHours(job.hoursPerWeek)].filter(Boolean).join("，");
  const tags = jobTags(job).slice(0, CARD_TAGS);

  return (
    <article className="group relative h-full rounded-md border border-border bg-surface p-4 hover:border-brand lg:p-5 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="break-words text-subtitle font-semibold group-hover:text-brand">
            <Link
              href={`/jobs/${job.id}`}
              transitionTypes={FORWARD}
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
          <Pay pay={job.pay} country={job.country} />
        </p>
      </div>

      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-body">
        {region && <Fact label="地区">{region}</Fact>}
        {hours && <Fact label="工时">{hours}</Fact>}
        {/* How to reach the employer, before opening the job (A25). */}
        <Fact label="联系">{job.contactPublic ? "联系方式公开" : "聊天交换联系方式"}</Fact>
      </dl>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        {employer && (
          <p className="flex min-w-0 items-center gap-1.5 text-body font-semibold">
            {/* Small in a row: the avatar component's own sizes are for chats and profile pages. */}
            <span className="shrink-0 *:size-5 *:text-meta">
              <EmployerAvatar employerId={employer.id} fallback={employer.name} />
            </span>
            <span className="truncate">{employer.name}</span>
            <span className="font-normal">
              <VerificationBadge verification={employer.verification} />
            </span>
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="标签">
              {tags.map((tag) => (
                <li key={tag}>
                  <Tag>{tag}</Tag>
                </li>
              ))}
            </ul>
          )}
          <SaveJobButton jobId={job.id} title={job.titleZh} />
          <ApplyRowButton jobId={job.id} title={job.titleZh} />
        </div>
      </div>
    </article>
  );
}

/**
 * The Round 19 card (操作质感, an app's feel): a white card with 16px corners and a soft shadow, no border. The title
 * and the pay lead; under them one light line of points (job-card-parts.ts), one status and at most two soft tags,
 * then the employer with 收藏 / 申请. The whole card opens the job (the title's link is stretched over it) and
 * gives a little when pressed; 收藏, 申请 and an `action` (立即沟通 on an employer's page) sit above the link, so
 * no button has to hang under the card.
 */
function AppJobCard({
  job,
  employer,
  headingLevel,
  action,
}: {
  job: Job;
  employer?: Employer;
  headingLevel: 2 | 3;
  action?: ReactNode;
}) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const points = cardPoints(job, regionById(job.country, job.regionId)?.nameZh);
  const status = cardStatus(job, employer);
  const tags = cardTags(job);

  return (
    <article className={`${linkCardClass()} h-full`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="line-clamp-2 text-subtitle font-semibold break-words group-hover:text-brand">
            <Link
              href={`/jobs/${job.id}`}
              transitionTypes={FORWARD}
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
          <Pay pay={job.pay} country={job.country} />
        </p>
      </div>

      <p className="mt-2 truncate text-body text-muted">
        {points.map((point, i) => (
          <span key={point}>
            {i > 0 && (
              <span aria-hidden="true" className="px-1.5 text-border">
                ·
              </span>
            )}
            {point}
          </span>
        ))}
      </p>

      {(status || tags.length > 0) && (
        <ul className="mt-2 flex flex-wrap items-center gap-1.5" aria-label="标签">
          {status?.kind === "urgent" && (
            <li>
              <SoftTag tone="urgent">急招</SoftTag>
            </li>
          )}
          {status?.kind === "verified" && (
            <li>
              <VerificationBadge verification={status.verification} />
            </li>
          )}
          {tags.map((tag) => (
            <li key={tag}>
              <SoftTag tone="brand">{tag}</SoftTag>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex items-center gap-2">
        {employer && (
          <p className="flex min-w-0 items-center gap-1.5 text-body">
            <span className="shrink-0 *:size-5 *:text-meta">
              <EmployerAvatar employerId={employer.id} fallback={employer.name} />
            </span>
            <span className="truncate">{employer.name}</span>
          </p>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <SaveJobButton jobId={job.id} title={job.titleZh} />
          <ApplyRowButton jobId={job.id} title={job.titleZh} />
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
