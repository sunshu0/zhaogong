import type { ReactNode } from "react";
import { TAG_STYLES, tagKindFor, type TagKind } from "@/components/ui/tag-kind";

/**
 * A small label with a thin border (Round 13). Pass `kind`, or leave it out to pick the colour from the label text
 * (see tagKindFor).
 * Example: `<Tag>急招</Tag>`, `<Tag kind="neutral">审核中</Tag>`.
 */
export function Tag({ kind, children }: { kind?: TagKind; children: ReactNode }) {
  const resolved = kind ?? (typeof children === "string" ? tagKindFor(children) : "neutral");
  return (
    <span
      className={`inline-flex w-fit items-center rounded-sm border bg-surface px-1.5 py-[3px] text-meta leading-none ${TAG_STYLES[resolved]}`}
    >
      {children}
    </span>
  );
}

const SOFT_TONES = {
  urgent: "bg-danger-soft font-semibold text-danger",
  brand: "bg-brand-soft font-semibold text-brand",
  neutral: "bg-neutral-soft text-muted",
};

/**
 * Round 19 cards' tags: a soft fill, no border; #375: 6px corners like the visual A sample. At most one status and
 * two others on a card.
 * Example: `<SoftTag tone="urgent">急招</SoftTag>`.
 */
export function SoftTag({ tone, children }: { tone: keyof typeof SOFT_TONES; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-meta leading-5 ${SOFT_TONES[tone]}`}
    >
      {children}
    </span>
  );
}
