"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { mySavedJobs, setMyJobStage, unsaveMyJob, type SavedJobView } from "@/app/[lang]/me/saved/actions";
import { SAVED_STAGES, SAVED_STAGE_LABELS, parseSavedStage } from "@/components/seeker/saved-jobs";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { sendWaitingChanges } from "@/components/seeker/chat-client";
import { identityScope } from "@/components/seeker/identity-scope";
import { formatDateZh } from "@/components/seeker/job-facts";
import { Pay } from "@/components/ui/Pay";
import { SoftTag } from "@/components/ui/Tag";
import { ButtonLink } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useAppliedJobIds } from "@/components/seeker/applied-client";

/**
 * 收藏和进度 (#52): the account's saved jobs, newest first, each with its stage; external jobs of 实习 and 专业职位
 * (#131) among them, marked 外部职位. Jobs taken down or past their closing date stay, marked 已下架. Only the account
 * sees this; employers never do. Round 19: each job a card, 进度 a Select (a bottom sheet on phones).
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

  if (!hydrated || (signedIn && jobs === undefined && !error)) return <SkeletonList count={2} label="正在加载收藏" />;

  if (!session) {
    return (
      <div className={`py-10 text-center ${cardClass()}`}>
        <p className="text-body font-medium">登录后可以收藏职位、记下求职进度</p>
        <ButtonLink href="/login?next=%2Fme%2Fsaved" className="mt-4">
          登录
        </ButtonLink>
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
      <div className={`py-10 text-center ${cardClass()}`}>
        <p className="text-body font-medium">还没有收藏的职位</p>
        <p className="mt-1 text-body text-muted">
          在职位上点「收藏」，就会出现在这里，可以记下联系、面试到录用的进度。
        </p>
        <ButtonLink href="/jobs" variant="secondary" className="mt-4">
          去看职位 →
        </ButtonLink>
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
          <li key={job.jobId} className={cardClass()}>
            <article aria-label={job.titleZh}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-subtitle font-semibold">
                    {job.gone ? (
                      <span className="text-muted">{job.titleZh}</span>
                    ) : (
                      <Link href={job.href} lang={job.external ? "en" : undefined} className="hover:text-brand">
                        {job.titleZh}
                      </Link>
                    )}
                    {job.external && <SoftTag tone="neutral">外部职位</SoftTag>}
                    {job.gone && <SoftTag tone="neutral">已下架</SoftTag>}
                    {applied?.has(job.jobId) && <SoftTag tone="brand">已申请</SoftTag>}
                  </h2>
                  {job.titleEn && (
                    <p lang="en" className="truncate font-latin text-meta text-muted">
                      {job.titleEn}
                    </p>
                  )}
                </div>
                {job.pay ? (
                  <p className={`shrink-0 leading-none ${job.gone ? "opacity-60" : ""}`}>
                    <Pay pay={job.pay} country={job.country} />
                  </p>
                ) : (
                  job.payText && <p className="shrink-0 text-meta text-muted">{job.payText}</p>
                )}
              </div>
              <p className="mt-1 text-body text-muted">
                {[job.region, job.employerName].filter(Boolean).join(" · ")} · {formatDateZh(job.savedAt, job.country)}
                收藏
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
                <div className="w-36">
                  <Select
                    label="进度"
                    required
                    value={job.stage}
                    options={SAVED_STAGES.map((stage) => ({ value: stage, label: SAVED_STAGE_LABELS[stage] }))}
                    onChange={(value) => {
                      const stage = parseSavedStage(value);
                      if (stage) void change(() => setMyJobStage(job.jobId, stage));
                    }}
                  />
                </div>
                {!job.picked && job.stage === "contacted" && (
                  <span className="pb-3 text-meta text-muted">聊天里交换过联系方式</span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    void change(async () => {
                      await unsaveMyJob(job.jobId);
                      return mySavedJobs();
                    })
                  }
                  className="pressable ml-auto inline-flex min-h-11 items-center text-meta text-muted hover:text-danger"
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
