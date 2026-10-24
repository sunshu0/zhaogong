import type { EmployerActivity } from "@/lib/employer-activity";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

/**
 * 「今天在线 · 通常 1 小时内回复」 under the employer on a job card or the job page (#381, ADR 0038). Nothing when there
 * is nothing good to say: no 'offline', no slow replies. Renders on the server and in the browser, so it is told the
 * language.
 */
export function EmployerActivityLine({
  activity,
  className = "",
  inline = false,
  lang = DEFAULT_LANG,
}: {
  activity?: EmployerActivity;
  className?: string;
  /** A span in a row (job cards) rather than a line of its own (the job page). */
  inline?: boolean;
  lang?: Lang;
}) {
  const t = pick(seekerJobsMessages, lang).activity;
  const parts = [activity?.onlineToday && t.onlineToday, activity?.replies && t.replies[activity.replies]].filter(
    (part): part is string => Boolean(part),
  );
  if (!parts.length) return null;
  // On a card it sits in the employer's row, after the name (which gives way first), so the card is no taller: a
  // phone still shows three whole cards (layout.spec, A21).
  const Tag = inline ? "span" : "p";
  return (
    <Tag
      data-employer-activity=""
      title={t.label}
      className={`text-meta font-normal text-muted ${inline ? "min-w-0 truncate" : ""} ${className}`}
    >
      {parts.join(t.join)}
    </Tag>
  );
}
