import Link from "next/link";
import { regionById } from "@/config/countries";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { Employer, Job } from "@/lib/types";
import { formatHours, jobTags } from "@/components/seeker/format";
import { Tag } from "@/components/ui/Tag";
import { Pay } from "@/components/ui/Pay";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { EmployerAvatar } from "@/components/seeker/ProfileAvatar";
import { SaveJobButton } from "@/components/seeker/SaveJobButton";

/** At most this many tags on a row; the job page shows everything. */
const CARD_TAGS = 3;

/**
 * One job in a list (Round 13: a row between thin lines, no card): title (zh, en) with the pay on the right, then
 * 地区 and 工时 with small grey labels and how the employer is reached, then the employer (avatar, name,
 * verification level), up to three tags and 收藏 (#52). Everything else (description, shifts, languages, visas) is on the job page. Only
 * the title is a link; it stretches over the whole row, so screen readers hear the title alone.
 */
export function JobCard({ job, employer, headingLevel = 2 }: { job: Job; employer?: Employer; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const region = regionById(job.country, job.regionId)?.nameZh;
  const hours = [formatEmploymentTypes(job.employmentType), formatHours(job.hoursPerWeek)].filter(Boolean).join("，");
  const tags = jobTags(job).slice(0, CARD_TAGS);

  return (
    <article className="group relative py-4 has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="break-words text-subtitle font-semibold group-hover:text-brand">
            <Link href={`/jobs/${job.id}`} className="outline-none after:absolute after:inset-0">
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
        </div>
      </div>
    </article>
  );
}

/** A grey label and its value, e.g. 「地区 北岸」. */
function Fact({ label, children }: { label: string; children: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Loading placeholder with the row's height, so the list does not jump when it arrives. */
export function JobCardSkeleton() {
  return <div className="h-28 animate-pulse border-b border-border" />;
}
