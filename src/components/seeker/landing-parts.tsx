// Building blocks of the landing page (/). Pictures are made from real data, never stock photos.
import { regionById } from "@/config/countries";
import { EMPLOYMENT_TYPE_LABELS, LANGUAGE_LABELS } from "@/i18n/labels";
import type { JobDraft } from "@/lib/compliance";
import type { Employer, Job } from "@/lib/types";
import { formatHours, formatPay, jobTags } from "@/components/seeker/format";
import type { PositioningIcon } from "@/components/seeker/landing";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

function Tag({ children, urgent }: { children: string; urgent?: boolean }) {
  return (
    <li className={`rounded px-1.5 py-0.5 text-xs ${urgent ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand"}`}>
      {children}
    </li>
  );
}

/** A job card as a picture: same facts as the list's card, but not a link. */
function PictureCard({ job, employer, className }: { job: Job; employer?: Employer; className: string }) {
  const facts = [regionById(job.country, job.regionId)?.nameZh, EMPLOYMENT_TYPE_LABELS[job.employmentType].zh].filter(Boolean);
  const tags = jobTags(job);
  return (
    <div className={`w-80 rounded-xl bg-surface p-4 text-foreground shadow-2xl ring-1 ring-black/5 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{job.titleZh}</p>
          <p className="truncate text-xs text-muted">{job.titleEn}</p>
        </div>
        <p className="shrink-0 font-semibold text-brand">{formatPay(job.pay, job.country)}</p>
      </div>
      {employer && (
        <p className="mt-2 flex items-center gap-2 text-sm">
          {employer.name}
          <VerificationBadge verification={employer.verification} />
        </p>
      )}
      <p className="mt-1 text-xs text-muted">{facts.join(" · ")}</p>
      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Tag key={tag} urgent={tag === "急招"}>
              {tag}
            </Tag>
          ))}
        </ul>
      )}
    </div>
  );
}

// Each card overlaps the one above by 0.25rem and turns at most 2°, so the overlap (under 1rem with the turn)
// stays inside the card's 1rem bottom padding: only card edges are covered, never text or tags.
const STACK_POSITIONS = ["ml-2 -rotate-2", "-mt-1 ml-24 rotate-[1.5deg]", "-mt-1 ml-10 -rotate-1"];

/** Three featured jobs stacked with a slight offset: the hero's picture on desktop. Decorative; the list below has the links. */
export function JobStack({ jobs, employers }: { jobs: Job[]; employers: Map<string, Employer> }) {
  return (
    <div aria-hidden="true" className="flex flex-col py-4" data-job-stack="">
      {jobs.slice(0, STACK_POSITIONS.length).map((job, i) => (
        <PictureCard key={job.id} job={job} employer={employers.get(job.employerId)} className={`relative ${STACK_POSITIONS[i]}`} />
      ))}
    </div>
  );
}

export function CheckIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`shrink-0 fill-current ${className}`}>
      <path d="M6.4 11.2 3.2 8l1.1-1.1 2.1 2.1 5.3-5.3 1.1 1.1z" />
    </svg>
  );
}

const ICON_PATHS: Record<PositioningIcon, string[]> = {
  // A speech bubble with lines of text.
  language: ["M4 5h16v10H9l-5 4z", "M8 9h8", "M8 12h5"],
  // A checklist.
  check: ["M10 6h10", "M10 12h10", "M10 18h10", "m3.5 6 1.5 1.5L8 4.5", "m3.5 12 1.5 1.5L8 10.5", "m3.5 18 1.5 1.5L8 16.5"],
  // A shield with a tick.
  shield: ["M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z", "m9 12 2 2 4-4"],
  // A gift.
  free: ["M4 11h16v9H4z", "M3 7h18v4H3z", "M12 7v13", "M12 7C10.5 4 7 4 7 6s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1z"],
};

export function PositioningIconSvg({ name }: { name: PositioningIcon }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Before → after for employers: a WeChat message and the job the post flow makes of it (parsed by parsePost). */
export function BeforeAfter({ message, draft, summaryEn }: { message: string; draft: JobDraft; summaryEn: string }) {
  const facts = [
    draft.regionId ? regionById("NZ", draft.regionId)?.nameZh : undefined,
    draft.employmentType ? EMPLOYMENT_TYPE_LABELS[draft.employmentType].zh : undefined,
    formatHours(draft.hoursPerWeek),
  ].filter(Boolean);
  const tags = [
    draft.urgent && "急招",
    draft.mealsIncluded && "包餐",
    draft.accommodationIncluded && "包住",
    draft.visaAccepted?.includes("student") && "学签可做",
  ].filter((t): t is string => Boolean(t));

  return (
    <figure className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div>
        <p className="mb-2 text-xs text-white/75">改前 · 微信群里的一段话</p>
        <div className="relative rounded-lg bg-[#95ec69] px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-black shadow-lg">
          <span aria-hidden="true" className="absolute top-4 -right-1.5 size-3 rotate-45 bg-[#95ec69]" />
          {message}
        </div>
      </div>

      <svg viewBox="0 0 24 24" aria-hidden="true" className="mx-auto size-8 rotate-90 text-white/75 lg:rotate-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h15" />
        <path d="m13 6 6 6-6 6" />
      </svg>

      <div>
        <p className="mb-2 text-xs text-white/75">改后 · 找工整理好的中英文职位</p>
        <div className="rounded-xl bg-surface p-4 text-foreground shadow-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{draft.titleZh}</p>
              <p lang="en" className="text-xs text-muted">
                {draft.titleEn}
              </p>
            </div>
            {draft.pay && <p className="shrink-0 font-semibold text-brand">{formatPay(draft.pay, "NZ")}</p>}
          </div>
          <p className="mt-2 text-xs text-muted">
            {facts.join(" · ")}
            {draft.shiftsZh && `，${draft.shiftsZh}`}
          </p>
          {tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Tag key={tag} urgent={tag === "急招"}>
                  {tag}
                </Tag>
              ))}
            </ul>
          )}
          {draft.languages && draft.languages.length > 0 && (
            <p className="mt-2 text-xs">工作语言：{draft.languages.map((l) => LANGUAGE_LABELS[l].zh).join("、")}</p>
          )}
          <p lang="en" className="mt-2 border-t border-border pt-2 text-xs text-muted">
            {summaryEn}
          </p>
          <p className="mt-2 text-xs text-muted">联系方式：登录后可见</p>
        </div>
      </div>
      <figcaption className="sr-only">一段微信招聘消息，由找工整理成中英文职位</figcaption>
    </figure>
  );
}
