"use client";
import Link from "next/link";
import { useState } from "react";
import { effectiveStatus, expiryLabelZh, STATUS_LABELS } from "@/components/employer/job-status";
import { signOutEmployer, useEmployerSession } from "@/components/employer/session";
import { SignInPanel, type DemoAccount } from "@/components/employer/SignInPanel";
import { useMyJobs } from "@/components/employer/use-my-jobs";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

const SHOWN = 5;

/** The signed-in employer's latest jobs, or a sign-in prompt. */
export function MyJobs({ accounts }: { accounts: DemoAccount[] }) {
  const session = useEmployerSession();
  const [signingIn, setSigningIn] = useState(false);
  const { ready } = useMyJobs(session?.employerId);

  if (session === undefined) return <div className="h-28 animate-pulse rounded-xl border border-border bg-surface" />;

  if (!session?.employerId) {
    return signingIn ? (
      <SignInPanel accounts={accounts} intro="登录后在这里查看你发布的职位。" />
    ) : (
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center">
        <p className="text-sm text-muted">登录后在这里查看和管理你发布的职位。</p>
        <button
          type="button"
          onClick={() => setSigningIn(true)}
          className="mt-3 rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand"
        >
          {session ? "选择店铺" : "登录"}
        </button>
      </div>
    );
  }

  const account = accounts.find((a) => a.id === session.employerId);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium">{account?.name ?? session.email}</span>
        {account && <VerificationBadge verification={account.verification} />}
        <button type="button" onClick={signOutEmployer} className="ml-auto text-muted underline">
          退出
        </button>
      </div>

      {!ready ? (
        <div className="h-28 animate-pulse rounded-xl border border-border bg-surface" />
      ) : ready.jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">
          还没有发布过职位。
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {ready.jobs.slice(0, SHOWN).map((job) => {
              const status = STATUS_LABELS[effectiveStatus(job, ready.now)];
              return (
                <li key={job.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{job.titleZh}</p>
                    <p className="text-xs text-muted">{expiryLabelZh(job, ready.now)}</p>
                  </div>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${status.className}`}>{status.zh}</span>
                </li>
              );
            })}
          </ul>
          <Link href="/employer/jobs" className="block text-right text-sm text-brand">
            管理全部 {ready.jobs.length} 个职位 →
          </Link>
        </>
      )}
    </div>
  );
}
