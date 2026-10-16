"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { mySavedJobs, setMyJobStage, unsaveMyJob, type SavedJobView } from "@/app/me/saved/actions";
import { SAVED_STAGES, SAVED_STAGE_LABELS, parseSavedStage } from "@/components/seeker/saved-jobs";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { sendWaitingChanges } from "@/components/seeker/chat-client";
import { identityScope } from "@/components/seeker/identity-scope";
import { formatDateZh } from "@/components/seeker/job-facts";
import { Pay } from "@/components/ui/Pay";
import { Tag } from "@/components/ui/Tag";
import { useAppliedJobIds } from "@/components/seeker/applied-client";

/**
 * 收藏和进度 (#52): the account's saved jobs, newest first, each with its stage. Jobs taken down or past their
 * closing date stay, marked 已下架. Only the account sees this; employers never do.
 */
export function SavedJobsPage() {
  const hydrated = useHydrated();
  const session = useSession();
  const signedIn = Boolean(session);
  const applied = useAppliedJobIds();
  // undefined: loading.
  const [jobs, setJobs] = useState<SavedJobView[] | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const scope = identityScope(session);
  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    // 已联系 comes from the chat on the server: first send chat changes this browser still holds.
    sendWaitingChanges(scope)
      .then(() => mySavedJobs())
      .then((list) => current && setJobs(list))
      .catch(() => current && setError("网络有问题，收藏暂时打不开，请稍后再试。"));
    return () => {
      current = false;
    };
  }, [signedIn, scope]);

  if (!hydrated || (signedIn && jobs === undefined && !error))
    return <div className="h-48 animate-pulse rounded-md border border-border bg-surface" aria-hidden="true" />;

  if (!session) {
    return (
      <div className="rounded-md border border-border bg-surface px-4 py-10 text-center">
        <p className="font-medium">登录后可以收藏职位、记下求职进度</p>
        <Link
          href="/login?next=%2Fme%2Fsaved"
          className="mt-4 inline-block rounded-md bg-brand px-4 py-2 text-sm font-medium text-white"
        >
          登录
        </Link>
      </div>
    );
  }

  if (error)
    return (
      <p role="alert" className="text-body text-danger">
        {error}
      </p>
    );

  if (!jobs || jobs.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface px-4 py-10 text-center">
        <p className="font-medium">还没有收藏的职位</p>
        <p className="mt-1 text-body text-muted">
          在职位上点「收藏」，就会出现在这里，可以记下联系、面试到录用的进度。
        </p>
        <Link href="/jobs" className="mt-4 inline-block text-body text-brand underline-offset-4 hover:underline">
          去看职位 →
        </Link>
      </div>
    );
  }

  async function change(run: () => Promise<SavedJobView[] | null>) {
    setError(null);
    try {
      setJobs(await run());
    } catch {
      setError("网络有问题，没有保存，请再试一次。");
    }
  }

  return (
    <div>
      <p className="mb-2 text-body text-muted">只有你自己看得到，雇主看不到。</p>
      <ul aria-label="收藏的职位" className="space-y-3">
        {jobs.map((job) => (
          <li key={job.jobId} className="rounded-md border border-border bg-surface p-4 lg:p-5">
            <article aria-label={job.titleZh}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-subtitle font-semibold">
                    {job.gone ? (
                      <span className="text-muted">{job.titleZh}</span>
                    ) : (
                      <Link href={`/jobs/${job.jobId}`} className="hover:text-brand">
                        {job.titleZh}
                      </Link>
                    )}
                    {job.gone && <Tag kind="neutral">已下架</Tag>}
                    {applied?.has(job.jobId) && <Tag kind="perk">已申请</Tag>}
                  </h2>
                  <p lang="en" className="truncate font-latin text-meta text-muted">
                    {job.titleEn}
                  </p>
                </div>
                <p className={`shrink-0 leading-none ${job.gone ? "opacity-60" : ""}`}>
                  <Pay pay={job.pay} country={job.country} />
                </p>
              </div>
              <p className="mt-1 text-body text-muted">
                {[job.region, job.employerName].filter(Boolean).join(" · ")} · {formatDateZh(job.savedAt, job.country)}
                收藏
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <label className="flex items-center gap-2 text-body">
                  进度
                  <select
                    value={job.stage}
                    onChange={(e) => {
                      const stage = parseSavedStage(e.target.value);
                      if (stage) void change(() => setMyJobStage(job.jobId, stage));
                    }}
                    className="rounded-md border border-border bg-surface px-2 py-1.5 text-body"
                  >
                    {SAVED_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {SAVED_STAGE_LABELS[stage]}
                      </option>
                    ))}
                  </select>
                </label>
                {!job.picked && job.stage === "contacted" && (
                  <span className="text-meta text-muted">聊天里交换过联系方式</span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    void change(async () => {
                      await unsaveMyJob(job.jobId);
                      return mySavedJobs();
                    })
                  }
                  className="ml-auto text-meta text-muted hover:text-danger"
                >
                  取消收藏
                </button>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
