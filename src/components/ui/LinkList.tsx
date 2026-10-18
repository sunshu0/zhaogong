import { contentLang } from "@/i18n/lang";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UnreadBadge } from "@/components/seeker/ChatEntry";

export type LinkListItem = { href: string; label: string; detail?: string; badge?: number };

/**
 * Rows that each open a page (我的, 待办): a label, an optional grey line under it, a count and a chevron. A row
 * darkens while pressed (Round 19), out to the edges of the Section it sits in.
 */
export function LinkList({ items, label }: { items: LinkListItem[]; label?: string }) {
  return (
    <ul aria-label={label}>
      {items.map((item) => (
        <li key={`${item.href}:${item.label}`} className="border-b border-border last:border-b-0">
          <Link
            href={item.href}
            className="pressable-row -mx-4 flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-background focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand sm:-mx-5 sm:px-5"
          >
            <span className="min-w-0 flex-1">
              <span lang={contentLang(item.label)} className="block text-subtitle">
                {item.label}
              </span>
              {item.detail && (
                <span lang={contentLang(item.detail)} className="block text-meta text-muted">
                  {item.detail}
                </span>
              )}
            </span>
            {item.badge ? <UnreadBadge count={item.badge} /> : null}
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
