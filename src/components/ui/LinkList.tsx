import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { UnreadBadge } from "@/components/seeker/ChatEntry";

export type LinkListItem = { href: string; label: string; detail?: string; badge?: number };

/** Rows that each open a page (我的, 待办): a label, an optional grey line under it, a count and a chevron. */
export function LinkList({ items, label }: { items: LinkListItem[]; label?: string }) {
  return (
    <ul aria-label={label}>
      {items.map((item) => (
        <li key={`${item.href}:${item.label}`} className="border-b border-border last:border-b-0">
          <Link href={item.href} className="flex min-h-14 items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-subtitle">{item.label}</span>
              {item.detail && <span className="block text-meta text-muted">{item.detail}</span>}
            </span>
            {item.badge ? <UnreadBadge count={item.badge} /> : null}
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
