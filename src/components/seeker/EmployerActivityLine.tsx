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
  lang = DEFAULT_LANG,
}: {
  activity?: EmployerActivity;
  className?: string;
  lang?: Lang;
}) {
  const t = pick(seekerJobsMessages, lang).activity;
  const parts = [activity?.onlineToday && t.onlineToday, activity?.replies && t.replies[activity.replies]].filter(
    (part): part is string => Boolean(part),
  );
  if (!parts.length) return null;
  return (
    <p data-employer-activity="" title={t.label} className={`text-meta text-muted ${className}`}>
      {parts.join(t.join)}
    </p>
  );
}
