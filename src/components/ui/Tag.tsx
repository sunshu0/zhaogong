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
