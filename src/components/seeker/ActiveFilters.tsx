import Link from "next/link";
import type { JobFilter } from "@/lib/types";
import { filterChips, jobsHref } from "@/components/seeker/filter-query";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

/** The filters in the URL, each removable on its own, in the page's language. */
export function ActiveFilters({ filter, lang = DEFAULT_LANG }: { filter: JobFilter; lang?: Lang }) {
  const t = pick(seekerJobsMessages, lang).filter;
  const chips = filterChips(filter, lang);
  if (chips.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.id}
          href={jobsHref(chip.query)}
          aria-label={t.remove(chip.label)}
          className="pressable inline-flex min-h-9 items-center gap-1 rounded-full bg-brand-soft pr-2.5 pl-3 text-body text-brand"
        >
          {chip.label}
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </Link>
      ))}
      {chips.length > 1 && (
        <Link href={jobsHref("")} className="px-1 text-body text-muted underline underline-offset-2">
          {t.clearAll}
        </Link>
      )}
    </div>
  );
}
