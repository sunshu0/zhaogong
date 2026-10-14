import Link from "next/link";
import { regionById } from "@/config/countries";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { Employer, Job } from "@/lib/types";
import { formatHours, formatPay, jobTags } from "@/components/seeker/format";
import { Tag } from "@/components/ui/Tag";
import { PAY_TEXT } from "@/components/ui/text";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { EmployerAvatar } from "@/components/seeker/ProfileAvatar";

/** At most this many tags on a card; the job page shows everything. */
const CARD_TAGS = 3;

/**
 * A compact job card: title (zh, en), pay, the employer and its verification level, region · type · hours, and
 * up to three tags. Everything else (description, shifts, languages, visas) is on the job page. Only the title
 * is a link; it stretches over the whole card, so screen readers hear the title alone.
 */
export function JobCard({ job, employer, headingLevel = 2 }: { job: Job; employer?: Employer; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const facts = [
    regionById(job.country, job.regionId)?.nameZh,
    formatEmploymentTypes(job.employmentType),
    formatHours(job.hoursPerWeek),
  ].filter(Boolean);
  const tags = jobTags(job).slice(0, CARD_TAGS);

  return (
    <article className="group relative h-full rounded-lg border border-border bg-surface p-3 transition-colors hover:border-brand/40 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand active:bg-background sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="break-words text-subtitle font-semibold group-hover:text-brand">
            <Link href={`/jobs/${job.id}`} className="outline-none after:absolute after:inset-0 after:rounded-lg">
              {job.titleZh}
            </Link>
          </Heading>
          <p className="truncate text-meta text-muted">{job.titleEn}</p>
        </div>
        <p className={`shrink-0 whitespace-nowrap ${PAY_TEXT.card}`}>{formatPay(job.pay, job.country)}</p>
      </div>

      <p className="mt-1 text-body text-muted">{facts.join(" · ")}</p>

      {employer && (
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-body">
          {/* Small on cards: the avatar component's own sizes are for chats and profile pages. */}
          <span className="shrink-0 *:size-6 *:text-meta">
            <EmployerAvatar employerId={employer.id} fallback={employer.name} />
          </span>
          <span className="truncate">{employer.name}</span>
          <VerificationBadge verification={employer.verification} />
        </p>
      )}

      {tags.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="标签">
          {tags.map((tag) => (
            <li key={tag}>
              <Tag>{tag}</Tag>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

/** Loading placeholder with the card's height, so the list does not jump when it arrives. */
export function JobCardSkeleton() {
  return <div className="h-36 animate-pulse rounded-lg border border-border bg-surface" />;
}
