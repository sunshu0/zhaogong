import Link from "next/link";
import type { ComponentProps, HTMLAttributes } from "react";

/**
 * Round 19 cards (操作质感): 16px corners and a soft shadow on white, no 1px border. A card that opens something is
 * pressable as a whole: it shrinks a little while pressed and lifts on hover (desktop). Use `cardClass` for elements
 * that cannot be Card or CardLink, and `rowClass` for rows of a list (they darken while pressed instead).
 */
export function cardClass({ interactive = false, padded = true } = {}) {
  return [
    "rounded-card bg-surface shadow-card",
    padded && "p-4 lg:p-5",
    interactive && "pressable cursor-pointer hover:shadow-pop focus-visible:outline-2 focus-visible:outline-brand",
  ]
    .filter(Boolean)
    .join(" ");
}

/** A row of a list (notifications, settings, saved searches): full width, darkens while pressed. */
export function rowClass() {
  return "pressable-row flex min-h-12 w-full items-center gap-3 px-4 text-left hover:bg-background focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand";
}

export function Card({
  interactive,
  padded,
  className = "",
  ...props
}: { interactive?: boolean; padded?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return <div className={`${cardClass({ interactive, padded })} ${className}`.trim()} {...props} />;
}

/** A whole card that is one link. Put no other links or buttons inside it. */
export function CardLink({ padded, className = "", ...props }: { padded?: boolean } & ComponentProps<typeof Link>) {
  return <Link className={`block ${cardClass({ interactive: true, padded })} ${className}`.trim()} {...props} />;
}
