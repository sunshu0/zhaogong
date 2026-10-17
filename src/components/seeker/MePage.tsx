"use client";

import Link from "next/link";
import { useId, type ReactNode } from "react";
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import { forgetViews, useSentReports, useViewedJobs } from "@/components/seeker/activity-client";
import { formatDateZh } from "@/components/seeker/job-facts";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { ManageJobs } from "@/components/employer/ManageJobs";
import { ButtonLink } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";

/**
 * /me (浏览与举报): jobs viewed and reports sent from this device. Account and sign-out are on 我的 (/account).
 * Round 19: the sample's type, each list a card, rows that darken while pressed.
 */
export function MePage() {
  const hydrated = useHydrated();
  const session = useSession();
  const views = useViewedJobs();
  const reports = useSentReports();

  if (!hydrated) return <SkeletonList count={2} label="正在加载浏览记录" />;

  if (!session) {
    return (
      <div className={`py-10 text-center ${cardClass()}`}>
        <p className="text-body font-medium">登录后可以查看浏览记录和举报记录</p>
        <ButtonLink href="/login?next=%2Fme" className="mt-4">
          登录
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {session.activeRole === "employer" ? (
        <section className="space-y-3" aria-label="招聘记录">
          <h2 className="text-subtitle font-semibold">招聘记录</h2>
          <ManageJobs />
        </section>
      ) : (
        <Panel
          title="最近看过的职位"
          count={views.length}
          action={
            views.length > 0 && (
              <button
                type="button"
                onClick={forgetViews}
                className="pressable inline-flex min-h-11 items-center text-meta text-muted underline underline-offset-2"
              >
                清除浏览记录
              </button>
            )
          }
        >
          {views.length === 0 ? (
            <Empty>
              还没有看过职位。
              <Link href="/jobs" className="text-brand underline underline-offset-2">
                去看看
              </Link>
            </Empty>
          ) : (
            <ul className="divide-y divide-border">
              {views.map((v) => (
                <li key={v.jobId}>
                  <Link
                    href={`/jobs/${v.jobId}`}
                    className={`${ROW} flex min-h-14 items-center justify-between gap-3 py-2.5`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-body font-medium">{v.title}</span>
                      <span className="block truncate text-meta text-muted">
                        {v.pay} · {v.region}
                      </span>
                    </span>
                    <span className="shrink-0 text-meta text-muted">{formatDateZh(v.at, "NZ")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel title="我发出的举报" count={reports.length}>
        {reports.length === 0 ? (
          <Empty>还没有举报过职位。</Empty>
        ) : (
          <ul className="divide-y divide-border">
            {reports.map((r) => (
              <li key={r.reportId}>
                <Link href={`/jobs/${r.jobId}`} className={`${ROW} block py-2.5`}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-body font-medium">{r.jobTitle}</span>
                    <span className="shrink-0 text-meta text-muted">{formatDateZh(r.at, "NZ")}</span>
                  </span>
                  <span className="block text-meta text-muted">
                    {REPORT_REASON_LABELS[r.reason].zh} · 已提交，等待核查
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="px-1 text-meta text-muted">演示版：这些记录只保存在这台设备上。</p>
    </div>
  );
}

function Panel({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cardClass()}>
      <div className="mb-1 flex min-h-11 items-center justify-between gap-3">
        <h2 id={headingId} className="text-subtitle font-semibold">
          {title}
          {count > 0 && <span className="ml-1.5 text-body font-normal text-muted">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-body text-muted">{children}</p>;
}

/** A row of a card's list: darkens while pressed, out to the card's edges. */
const ROW = "pressable-row -mx-4 px-4 hover:bg-background lg:-mx-5 lg:px-5";
