"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, type ReactNode } from "react";
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import { forgetViews, useSentReports, useViewedJobs } from "@/components/seeker/activity-client";
import { formatDateZh } from "@/components/seeker/job-facts";
import { employerSignUpHref, identityLabel } from "@/components/seeker/identity";
import { signOut, useHydrated, useSession } from "@/components/seeker/session-client";
import { ManageJobs } from "@/components/employer/ManageJobs";

/** /me: who is signed in, jobs viewed and reports sent from this device, sign out. */
export function MePage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const session = useSession();
  const views = useViewedJobs();
  const reports = useSentReports();

  if (!hydrated)
    return <div className="h-48 animate-pulse rounded-xl border border-border bg-surface" aria-hidden="true" />;

  if (!session) {
    return (
      <div className="rounded-xl border border-border bg-surface px-4 py-10 text-center">
        <p className="font-medium">登录后可以查看浏览记录和举报记录</p>
        <Link
          href="/login?next=%2Fme"
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          登录
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <section className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">已登录</p>
          <p className="truncate font-medium">{session.email}</p>
          <p className="mt-1 text-xs text-muted">
            当前身份：{identityLabel(session)}
            {!session.employerId && (
              <>
                {" · "}
                <Link href={employerSignUpHref()} className="text-brand underline underline-offset-2">
                  开通雇主身份
                </Link>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            signOut();
            router.push("/jobs");
          }}
          className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-sm"
        >
          退出登录
        </button>
      </section>

      {session.activeRole === "employer" ? (
        <section className="space-y-3" aria-label="招聘记录">
          <h2 className="text-lg font-semibold">招聘记录</h2>
          <ManageJobs />
        </section>
      ) : (
        <Panel
          title="最近看过的职位"
          count={views.length}
          action={
            views.length > 0 && (
              <button type="button" onClick={forgetViews} className="text-xs text-muted underline underline-offset-2">
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
                  <Link href={`/jobs/${v.jobId}`} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{v.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {v.pay} · {v.region}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted">{formatDateZh(v.at, "NZ")}</span>
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
              <li key={r.reportId} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Link href={`/jobs/${r.jobId}`} className="min-w-0 truncate text-sm font-medium">
                    {r.jobTitle}
                  </Link>
                  <span className="shrink-0 text-xs text-muted">{formatDateZh(r.at, "NZ")}</span>
                </div>
                <p className="text-xs text-muted">{REPORT_REASON_LABELS[r.reason].zh} · 已提交，等待核查</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="px-1 text-xs text-muted">演示版：这些记录只保存在这台设备上。</p>
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
    <section aria-labelledby={headingId} className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 id={headingId} className="font-medium">
          {title}
          {count > 0 && <span className="ml-1.5 text-sm font-normal text-muted">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-sm text-muted">{children}</p>;
}
