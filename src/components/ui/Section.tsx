import type { ReactNode } from "react";

type Heading = "h2" | "h3";

/**
 * A content area: white on the page background (Round 11 layer two). On phones it runs edge to edge with lines
 * above and below; from 640 px it is a rounded panel. Its children are Groups, split by thin lines; do not put
 * cards inside it, and no shadows. Stack sections with `space-y-section`. On phones it reaches out over the page's 16 px side
 * padding (main has it), so do not put it inside another padded box.
 * `look="app"` (Round 19): a card at every width — 16px corners and a soft shadow, no border, inside the page's
 * padding rather than edge to edge. Stack them with `space-y-section` as before.
 * `look="sheet"` (visual A, V2, ADR 0036): the same shape with a thin line instead of the shadow — a section opens
 * nothing, so it does not look like a card. The seekers' pages, 我的 (#377), the employers' pages, 防骗指南 and
 * 关于 (#392) use it; `app` is left on the moderators' pages and a candidate's page until their turn.
 */
export function Section({
  title,
  description,
  action,
  as: HeadingTag = "h2",
  id,
  look = "panel",
  className = "",
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  /** One small action beside the title, usually a text link such as 查看全部. */
  action?: ReactNode;
  as?: Heading;
  /** Names the section after its title for screen readers (the heading gets `${id}-title`). */
  id?: string;
  look?: "panel" | "app" | "sheet";
  className?: string;
  children: ReactNode;
}) {
  const box =
    look === "sheet"
      ? "rounded-card bg-surface px-4 ring-1 ring-border sm:px-5"
      : look === "app"
        ? "rounded-card bg-surface px-4 shadow-card sm:px-5"
        : "-mx-4 border-y border-border bg-surface px-4 sm:mx-0 sm:rounded-md sm:border sm:px-5";
  const headingId = id && title ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={`${box} ${className}`.trim()}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 pt-group">
          <div className="min-w-0">
            {title && (
              <HeadingTag id={headingId} className="text-subtitle font-semibold">
                {title}
              </HeadingTag>
            )}
            {description && <p className="mt-0.5 text-meta text-muted">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

/** A group inside a Section: spacing and a thin line between groups, no box of its own. */
export function Group({
  title,
  as: HeadingTag = "h3",
  className = "",
  children,
}: {
  title?: ReactNode;
  as?: Heading | "h4";
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`py-group ${className}`.trim()}>
      {title && <HeadingTag className="mb-2 text-body font-medium text-muted">{title}</HeadingTag>}
      {children}
    </div>
  );
}
