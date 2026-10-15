import type { ReactNode } from "react";

type Heading = "h2" | "h3";

/**
 * A content area: white on the page background (Round 11 layer two). On phones it runs edge to edge with lines
 * above and below; from 640 px it is a rounded panel. Its children are Groups, split by thin lines; do not put
 * cards inside it, and no shadows. Stack sections with `space-y-section`. On phones it reaches out over the page's 16 px side
 * padding (main has it), so do not put it inside another padded box.
 */
export function Section({
  title,
  description,
  action,
  as: HeadingTag = "h2",
  id,
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
  className?: string;
  children: ReactNode;
}) {
  const headingId = id && title ? `${id}-title` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`-mx-4 border-y border-border bg-surface px-4 sm:mx-0 sm:rounded-md sm:border sm:px-5 ${className}`.trim()}
    >
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
