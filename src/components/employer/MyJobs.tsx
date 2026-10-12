"use client";
import Link from "next/link";
import { effectiveStatus, expiryLabelZh, STATUS_LABELS } from "@/components/employer/job-status";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useMyJobs } from "@/components/employer/use-my-jobs";
import { employerSignUpHref } from "@/components/seeker/identity";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

const SHOWN = 5;

/** On the open /employer page: the account's latest jobs, or how to get the employer identity. */
export function MyJobs() {
  const hydrated = useHydrated();
  const session = useSession();
  const email = session?.employerId ? session.email : undefined;
  const { ready } = useMyJobs(email);
  const { profile } = useEmployerProfile(email);

  if (!hydrated) return <div className="h-28 animate-pulse rounded-xl border border-border bg-surface" />;

  if (!email) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center">
        <p className="text-sm text-muted">
          {session ? "开通雇主身份后，在这里查看和管理你发布的职位。" : "注册或登录雇主账号后，在这里查看和管理你发布的职位。"}
        </p>
        <Link href={employerSignUpHref("/employer")} className="mt-3 inline-block rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand">
          {session ? "开通雇主身份" : "注册 / 登录"}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium">{profile?.name ?? session?.employerName}</span>
        {profile && <VerificationBadge verification={profile.verification} />}
      </p>
      {profile?.bannedAt && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">这个雇主账号已被停用，职位已全部下架，不能再发布。</p>}

      {!ready ? (
        <div className="h-28 animate-pulse rounded-xl border border-border bg-surface" />
      ) : ready.jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-6 text-center text-sm text-muted">还没有发布过职位。</div>
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
