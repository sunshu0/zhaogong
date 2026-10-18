// Building blocks of the landing page (/). Pictures are made from real data, never stock photos.
import { regionById } from "@/config/countries";
import { LANGUAGE_LABELS } from "@/i18n/labels";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { JobDraft } from "@/lib/compliance";
import { formatHours, formatPay, placeName } from "@/components/seeker/format";
import type { FeatureIcon } from "@/components/seeker/landing";
import { contentLang, DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerHomeMessages } from "@/i18n/messages/seeker-home";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

function Tag({ children, urgent }: { children: string; urgent?: boolean }) {
  return (
    <li
      className={`rounded px-1.5 py-0.5 text-xs ${urgent ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand"}`}
    >
      {children}
    </li>
  );
}

/** A job card as a picture: same facts as the list's card, but not a link. */
export function CheckIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`shrink-0 fill-current ${className}`}>
      <path d="M6.4 11.2 3.2 8l1.1-1.1 2.1 2.1 5.3-5.3 1.1 1.1z" />
    </svg>
  );
}

const ICON_PATHS: Record<FeatureIcon, string[]> = {
  // Two speech bubbles.
  chat: ["M3 5h12v8H7l-4 3z", "M9 16v1h8l4 3V9h-3"],
  // A speech bubble with 文-like strokes.
  language: ["M4 5h16v10H9l-5 4z", "M8 9h8", "M12 7v2", "M9.5 13l2.5-4 2.5 4"],
  // A checklist.
  check: [
    "M10 6h10",
    "M10 12h10",
    "M10 18h10",
    "m3.5 6 1.5 1.5L8 4.5",
    "m3.5 12 1.5 1.5L8 10.5",
    "m3.5 18 1.5 1.5L8 16.5",
  ],
  // A shield with a tick.
  shield: ["M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z", "m9 12 2 2 4-4"],
};

export function FeatureIconSvg({ name }: { name: FeatureIcon }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Before → after for employers: a WeChat message and the job the post flow makes of it (parsed by parsePost). */
export function BeforeAfter({
  message,
  draft,
  summaryEn,
  lang = DEFAULT_LANG,
}: {
  message: string;
  draft: JobDraft;
  summaryEn: string;
  /** The page's language (Round 20). The message and the job's Chinese are the employer's, marked zh-CN. */
  lang?: Lang;
}) {
  const t = pick(seekerHomeMessages, lang).beforeAfter;
  const words = pick(seekerJobsMessages, lang).tags;
  const facts = [
    draft.regionId ? placeName(regionById("NZ", draft.regionId), lang) : undefined,
    formatEmploymentTypes(draft.employmentType, lang),
    formatHours(draft.hoursPerWeek, lang),
  ].filter(Boolean);
  const tags = [
    draft.urgent && { key: "urgent", word: words.urgent },
    draft.mealsIncluded && { key: "meals", word: words.meals },
    draft.accommodationIncluded && { key: "housing", word: words.housing },
    draft.visaAccepted?.includes("student") && { key: "student", word: words.student },
  ].filter((tag): tag is { key: string; word: string } => Boolean(tag));

  return (
    <figure className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
      <div>
        <p className="mb-2 text-xs text-white/75">{t.before}</p>
        <div
          lang="zh-CN"
          className="relative rounded-lg bg-[#95ec69] px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-black"
        >
          <span aria-hidden="true" className="absolute top-4 -right-1.5 size-3 rotate-45 bg-[#95ec69]" />
          {message}
        </div>
      </div>

      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="mx-auto size-8 rotate-90 text-white/75 lg:rotate-0"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12h15" />
        <path d="m13 6 6 6-6 6" />
      </svg>

      <div>
        <p className="mb-2 text-xs text-white/75">{t.after}</p>
        <div className="rounded-md bg-surface p-4 text-foreground">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p lang={contentLang(draft.titleZh)} className="font-semibold">
                {draft.titleZh}
              </p>
              <p lang="en" className="text-xs text-muted">
                {draft.titleEn}
              </p>
            </div>
            {draft.pay && <p className="shrink-0 font-semibold text-brand">{formatPay(draft.pay, "NZ", lang)}</p>}
          </div>
          <p className="mt-2 text-xs text-muted">
            {facts.join(" · ")}
            {draft.shiftsZh && (
              <>
                {pick(seekerJobsMessages, lang).detail.clauseJoin}
                <span lang={contentLang(draft.shiftsZh)}>{draft.shiftsZh}</span>
              </>
            )}
          </p>
          {tags.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <Tag key={tag.key} urgent={tag.key === "urgent"}>
                  {tag.word}
                </Tag>
              ))}
            </ul>
          )}
          {draft.languages && draft.languages.length > 0 && (
            <p className="mt-2 text-xs">
              {t.languages(draft.languages.map((l) => LANGUAGE_LABELS[l][lang]).join(t.listJoin))}
            </p>
          )}
          <p lang="en" className="mt-2 border-t border-border pt-2 text-xs text-muted">
            {summaryEn}
          </p>
          <p className="mt-2 text-xs text-muted">{t.contact}</p>
        </div>
      </div>
      <figcaption className="sr-only">{t.caption}</figcaption>
    </figure>
  );
}
