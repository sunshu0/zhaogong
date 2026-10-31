"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { mySavedJobs, setMyJobStage, unsaveMyJob, type SavedJobView } from "@/app/[lang]/me/saved/actions";
import { SAVED_STAGES, parseSavedStage } from "@/components/seeker/saved-jobs";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { sendWaitingChanges } from "@/components/seeker/chat-client";
import { identityScope } from "@/components/seeker/identity-scope";
import { formatJobDate } from "@/components/seeker/job-facts";
import { Pay } from "@/components/ui/Pay";
import { SoftTag } from "@/components/ui/Tag";
import { ButtonLink } from "@/components/ui/Button";
import { cardClass, sheetClass } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useAppliedJobIds } from "@/components/seeker/applied-client";
import { RetryLine } from "@/components/seeker/RetryLine";
import { useLang, useMessages } from "@/i18n/client";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { contentLang } from "@/i18n/lang";

/**
 * 收藏和进度 (#52): the account's saved jobs, newest first, each with its stage; external jobs of 实习 and 专业职位
 * (#131) among them, marked 外部职位. Jobs taken down or past their closing date stay, marked 已下架. Only the account
 * sees this; employers never do. Round 19: each job a card, 进度 a Select (a bottom sheet on phones).
 */
export function SavedJobsPage() {
  const lang = useLang();
  const t = useMessages(seekerMeMessages);
  const s = t.saved;
  const hydrated = useHydrated();
  const session = useSession();
  const signedIn = Boolean(session);
  const applied = useAppliedJobIds();
  // undefined: loading.
  const [jobs, setJobs] = useState<SavedJobView[] | null | undefined>(undefined);
  // A change (进度, 取消收藏) that got no answer: said above the list with 重试, which sends it again; the list stays.
  const [failedChange, setFailedChange] = useState<(() => Promise<SavedJobView[] | null>) | null>(null);
  // The list got no answer (#254): said with 重试, which asks again; kept per identity, so another identity's list
  // is not hidden behind it.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [asked, setAsked] = useState(0);

  const scope = identityScope(session);
  const loadFailed = failedFor === scope;
  useEffect(() => {
    if (!signedIn) return;
    let current = true;
    // 已联系 comes from the chat on the server: first send chat changes this browser still holds.
    sendWaitingChanges(scope)
      .then(() => mySavedJobs())
      .then((list) => current && setJobs(list))
      .catch(() => current && setFailedFor(scope));
    return () => {
      current = false;
    };
  }, [signedIn, scope, asked]);

  if (!hydrated || (signedIn && jobs === undefined && !loadFailed))
    return <SkeletonList count={2} label={t.pages.loadingSaved} />;

  if (!session) {
    return (
      <div className={`py-10 text-center ${sheetClass()}`}>
        <p className="text-body font-medium">{s.signInFor}</p>
        <ButtonLink href="/login?next=%2Fme%2Fsaved" className="mt-4">
          {t.pages.signIn}
        </ButtonLink>
      </div>
    );
  }

  if (loadFailed)
    return (
      <RetryLine
        text={s.loadFailed}
        onRetry={() => {
          setFailedFor(null);
          setAsked((n) => n + 1);
        }}
      />
    );

  if (!jobs || jobs.length === 0) {
    return (
      <div className={`py-10 text-center ${sheetClass()}`}>
        <p className="text-body font-medium">{s.emptyTitle}</p>
        <p className="mt-1 text-body text-muted">{s.emptyHint}</p>
        <ButtonLink href="/jobs" variant="secondary" className="mt-4">
          {s.browse}
        </ButtonLink>
      </div>
    );
  }

  async function change(run: () => Promise<SavedJobView[] | null>) {
    setFailedChange(null);
    try {
      setJobs(await run());
    } catch {
      setFailedChange(() => run);
    }
  }

  return (
    <div>
      <p className="mb-2 text-body text-muted">{s.onlyYou}</p>
      {failedChange && <RetryLine text={s.saveFailed} onRetry={() => void change(failedChange)} className="mb-2" />}
      <ul aria-label={s.list} className="space-y-3">
        {jobs.map((job) => (
          <li key={job.jobId} className={cardClass()}>
            <article aria-label={job.titleZh}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-center gap-2 text-subtitle font-semibold">
                    {job.gone ? (
                      <span lang={contentLang(job.titleZh)} className="text-muted">
                        {job.titleZh}
                      </span>
                    ) : (
                      <Link
                        href={job.href}
                        lang={job.external ? "en" : contentLang(job.titleZh)}
                        className="hover:text-brand"
                      >
                        {job.titleZh}
                      </Link>
                    )}
                    {job.external && <SoftTag tone="neutral">{s.external}</SoftTag>}
                    {job.gone && <SoftTag tone="neutral">{s.gone}</SoftTag>}
                    {applied?.has(job.jobId) && <SoftTag tone="brand">{s.applied}</SoftTag>}
                  </h2>
                  {job.titleEn && (
                    <p lang="en" className="truncate font-latin text-meta text-muted">
                      {job.titleEn}
                    </p>
                  )}
                </div>
                {job.pay ? (
                  <p className="shrink-0 leading-none">
                    <Pay pay={job.pay} country={job.country} lang={lang} />
                  </p>
                ) : (
                  job.payText && <p className="shrink-0 text-meta text-muted">{job.payText}</p>
                )}
              </div>
              <p className="mt-1 text-body text-muted">
                {job.region && `${job.region} · `}
                {job.employerName && (
                  <>
                    <span lang={contentLang(job.employerName)}>{job.employerName}</span> ·{" "}
                  </>
                )}
                {t.saved.savedOn(formatJobDate(job.savedAt, job.country, lang))}
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-2">
                <div className="w-36">
                  <Select
                    label={s.stage}
                    required
                    value={job.stage}
                    options={SAVED_STAGES.map((stage) => ({ value: stage, label: s.stages[stage] }))}
                    onChange={(value) => {
                      const stage = parseSavedStage(value);
                      if (stage) void change(() => setMyJobStage(job.jobId, stage));
                    }}
                  />
                </div>
                {!job.picked && job.stage === "contacted" && (
                  <span className="pb-3 text-meta text-muted">{s.swapped}</span>
                )}
                <Unsave
                  stage={job.stage}
                  onUnsave={() =>
                    void change(async () => {
                      await unsaveMyJob(job.jobId);
                      return mySavedJobs();
                    })
                  }
                />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 取消收藏: at once while the progress is 已收藏; with progress set (已联系, 已面试…) it asks once in the row, as
 * 提醒's 删除 does, since the progress goes with it (UI audit 3). The focus follows the swap.
 */
function Unsave({ stage, onUnsave }: { stage: SavedJobView["stage"]; onUnsave: () => void }) {
  const s = useMessages(seekerMeMessages).saved;
  const [confirming, setConfirming] = useState(false);
  const swapped = useRef(false);
  const unsaveButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const warningId = useId();
  useEffect(() => {
    if (!swapped.current) return;
    (confirming ? confirmButton : unsaveButton).current?.focus();
  }, [confirming]);
  const swap = (next: boolean) => {
    swapped.current = true;
    setConfirming(next);
  };
  const small = "pressable inline-flex min-h-11 items-center px-1 text-body underline-offset-4";
  return confirming ? (
    <span className="ml-auto flex flex-wrap items-center justify-end gap-x-2 text-body">
      <span id={warningId} className="text-muted">
        {s.unsaveWarning}
      </span>
      <button
        ref={confirmButton}
        type="button"
        aria-describedby={warningId}
        onClick={onUnsave}
        className={`${small} font-medium text-danger hover:underline`}
      >
        {s.confirmUnsave}
      </button>
      <button type="button" onClick={() => swap(false)} className={`${small} text-brand hover:underline`}>
        {s.keep}
      </button>
    </span>
  ) : (
    <button
      ref={unsaveButton}
      type="button"
      onClick={() => (stage === "saved" ? onUnsave() : swap(true))}
      className={`${small} ml-auto text-muted hover:text-danger`}
    >
      {s.unsave}
    </button>
  );
}
