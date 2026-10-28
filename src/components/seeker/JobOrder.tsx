import Link from "next/link";
import { jobsHref } from "@/components/seeker/filter-query";
import { withJobOrder, type JobOrder as Order } from "@/components/seeker/job-order-query";
import type { JobOrderStatus } from "@/lib/job-ordering.server";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import type { Lang } from "@/i18n/lang";

/**
 * The order is chosen in the filter form (the phone's sheet, the desktop column), so the list keeps three whole cards
 * on a 375 x 812 phone (A21, review F1 补充裁定). Here: why Recommended fell back to the latest order, and, without
 * scripts only, links to switch. Server-rendered; contains no personal preference values.
 */
export function JobOrder({
  order,
  status,
  query,
  lang,
}: {
  order: Order;
  status: JobOrderStatus;
  query: string;
  lang: Lang;
}) {
  const t = pick(seekerJobsMessages, lang).order;
  const notice = status === "latest" ? null : t[status];
  return (
    <>
      {/* The phone's sheet needs scripts; with scripts on the browser ignores this. */}
      <noscript>
        <nav aria-label={t.label} className="mb-3 inline-flex rounded-full bg-surface p-1 shadow-card">
          {(["recommended", "latest"] as const).map((value) => (
            <a
              key={value}
              href={jobsHref(withJobOrder(query, value))}
              // A personal order is not a page of its own for search engines (the list is the same jobs).
              rel={value === "recommended" ? "nofollow" : undefined}
              aria-current={value === order ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full px-5 text-body font-medium ${value === order ? "bg-brand text-white" : "text-muted"}`}
            >
              {t[value === "recommended" ? "recommendedLabel" : "latestLabel"]}
            </a>
          ))}
        </nav>
      </noscript>
      {/* With no results (status latest) there is nothing to explain: the list's own empty message says why. */}
      {notice && (
        <div className="mb-3 space-y-2">
          <p className="text-meta leading-relaxed text-muted" data-job-order-status={status}>
            {notice}{" "}
            {status === "signed_out" ? (
              <Link
                href={`/login?next=${encodeURIComponent(jobsHref(withJobOrder(query, "recommended")))}`}
                className="text-brand underline underline-offset-2"
              >
                {t.signIn}
              </Link>
            ) : status === "employer" ? (
              <Link href="/account" className="text-brand underline underline-offset-2">
                {t.switchIdentity}
              </Link>
            ) : (
              <Link href="/profile" className="text-brand underline underline-offset-2">
                {t.edit}
              </Link>
            )}
          </p>
          {order === "recommended" && <p className="text-meta text-muted">{t.private}</p>}
        </div>
      )}
    </>
  );
}
