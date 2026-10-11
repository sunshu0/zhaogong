import Link from "next/link";
import type { JobFilter } from "@/lib/types";
import { filterChips } from "@/components/seeker/filter-query";

/** The filters in the URL, each removable on its own. */
export function ActiveFilters({ filter }: { filter: JobFilter }) {
  const chips = filterChips(filter);
  if (chips.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <Link
          key={chip.id}
          href={chip.query ? `/?${chip.query}` : "/"}
          aria-label={`去掉条件：${chip.label}`}
          className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pr-2 pl-3 text-sm text-brand"
        >
          {chip.label}
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </Link>
      ))}
      {chips.length > 1 && (
        <Link href="/" className="px-1 text-sm text-muted underline underline-offset-2">
          全部清除
        </Link>
      )}
    </div>
  );
}
