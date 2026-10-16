"use client";
import { useState, useTransition } from "react";
import { regionById } from "@/config/countries";
import type { Employer, Job } from "@/lib/types";
import { closeMyJob, confirmHires, renewMyJob, type ChangeResult } from "@/app/employer/actions";
import {
  canEdit,
  canRepublish,
  closeDateZh,
  effectiveStatus,
  expiryLabelZh,
  jobPhase,
  renewDaysLeft,
  renewedExpiry,
  type Phase,
} from "@/components/employer/job-status";
import { hiresLabelZh, type HiresAnswer } from "@/components/employer/hires";
import { HiresQuestion } from "@/components/employer/HiresQuestion";
import { RenewQuestion } from "@/components/employer/RenewQuestion";
import { ACTION_BUTTON, JobActions, type Asking, type Run } from "@/components/employer/ManagedJobActions";
import { ShareTexts } from "@/components/employer/ShareTexts";
import Link from "next/link";
import type { JobNumbers } from "@/db/job-stats";
import type { RenewalCounts } from "@/db/job-renewals";
import type { ApplicationCount } from "@/db/job-applications";
import { applicantsLabelZh, cardNumbers } from "@/components/employer/job-card";
import { Figures, PhaseTag } from "@/components/employer/StatusTag";
import { Pay } from "@/components/ui/Pay";

/** Tells the list what happened, with the text to show when it worked. */
export type JobChangeDone = (result: ChangeResult, okText: string) => void;

/**
 * One of the employer's jobs, as a row between thin lines (Round 13): what it is, where it stands, and what can be
 * done with it.
 */
export function ManagedJob({
  job,
  employer,
  numbers,
  renewals,
  applications,
  now,
  onDone,
}: {
  job: Job;
  employer?: Employer;
  /** Views, chats and contact views from the server (#55). */
  numbers: JobNumbers;
  /** How often it was renewed (#69), when it was. */
  renewals?: RenewalCounts[string];
  /** Applications (#84). */
  applications?: ApplicationCount;
  now: number;
  onDone: JobChangeDone;
}) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<Asking>();
  const [sharing, setSharing] = useState(false);
  const status = effectiveStatus(job, now);
  const phase = jobPhase(job, now);

  const run: Run = (action, okText) =>
    startTransition(async () => {
      onDone(await action(), okText);
      setAsking(undefined);
    });

  return (
    <article className="py-4">
      <JobSummary job={job} phase={phase} numbers={numbers} renewals={renewals} applications={applications} now={now} />
      <StatusNote
        job={job}
        phase={phase}
        now={now}
        onRenew={canEdit(job) && !asking ? () => setAsking("renew") : undefined}
      />
      {canEdit(job) && (
        <JobActions
          job={job}
          now={now}
          pending={pending}
          asking={asking}
          sharing={sharing}
          run={run}
          onAsk={setAsking}
          onToggleShare={() => setSharing((s) => !s)}
        />
      )}
      {asking === "close" && (
        <CloseQuestion job={job} pending={pending} run={run} onCancel={() => setAsking(undefined)} />
      )}
      {asking === "renew" && (
        <RenewQuestion
          job={job}
          now={now}
          submitClassName={`${ACTION_BUTTON} border-brand text-brand`}
          pending={pending}
          onSubmit={(days) => run(() => renewMyJob(job.id, days), renewDoneText(job, now, days))}
          onCancel={() => setAsking(undefined)}
        />
      )}
      {asking === "hires" && (
        <HiresCorrection job={job} pending={pending} run={run} onCancel={() => setAsking(undefined)} />
      )}
      {sharing && status === "active" && (
        <div className="mt-3">
          <ShareTexts job={job} employer={employer} />
        </div>
      )}
    </article>
  );
}

function JobSummary({
  job,
  phase,
  numbers,
  renewals,
  applications,
  now,
}: {
  job: Job;
  phase: Phase;
  numbers: JobNumbers;
  renewals?: RenewalCounts[string];
  applications?: ApplicationCount;
  now: number;
}) {
  const hires = hiresLabelZh(job);
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-subtitle font-semibold">{job.titleZh}</h2>
          <p className="truncate text-meta text-muted">
            <span lang="en" className="font-latin">
              {job.titleEn}
            </span>{" "}
            · {regionById(job.country, job.regionId)?.nameZh}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <PhaseTag phase={phase} />
          <p className="leading-none">
            <Pay pay={job.pay} country={job.country} />
          </p>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body text-muted">
        <span>
          <Figures>{expiryLabelZh(job, now)}</Figures>
        </span>
        {cardNumbers(job, numbers).map((n) => (
          <span key={n}>
            <Figures>{n}</Figures>
          </span>
        ))}
        <Link href={`/employer/jobs/${job.id}/stats`} className="text-brand underline-offset-4 hover:underline">
          近 14 天
        </Link>
        {/* #84: who applied; the list marks them seen. */}
        <Link href={`/employer/jobs/${job.id}/applicants`} className="text-brand underline-offset-4 hover:underline">
          <Figures>{applicantsLabelZh(applications)}</Figures>
        </Link>
        {renewals && (
          <span>
            <Figures>{`已续期 ${renewals.count} 次`}</Figures>
          </span>
        )}
        {hires && <span className="font-medium text-ok">{hires}</span>}
      </p>
    </>
  );
}

/**
 * Why a job is not live, when it is not; and from 3 days before it closes, that it is closing and can be renewed
 * (#69), with the button right there.
 */
function StatusNote({ job, phase, now, onRenew }: { job: Job; phase: Phase; now: number; onRenew?: () => void }) {
  if (phase === "removed")
    return <p className="mt-2 text-body text-danger">这个职位已被后台下架。如有疑问请联系我们。</p>;
  if (phase === "pending_review") return <p className="mt-2 text-body text-warn">审核通过后才会公开。</p>;
  if (phase === "ending" || (phase === "timed_out" && renewDaysLeft(job, now) > 0)) {
    const text =
      phase === "ending"
        ? `${closeDateZh(job.expiresAt)}截止。还要招人就续期，在列表里的位置不变。`
        : `${closeDateZh(job.expiresAt)}已截止，求职者看不到了。${renewDaysLeft(job, now)} 天内还可以续期。`;
    return (
      <p className="mt-2 text-body text-warn">
        {text}
        {onRenew && (
          <button type="button" onClick={onRenew} className="ml-1 font-medium text-brand underline underline-offset-4">
            续期
          </button>
        )}
      </p>
    );
  }
  if (canRepublish(job, now))
    return (
      <p className="mt-2 text-body text-muted">
        截止超过 14 天，不能再续期。还要招人的话，用原内容
        <Link href={`/employer/jobs/${job.id}/republish`} className="mx-1 text-brand underline underline-offset-4">
          重新发布
        </Link>
        一条新职位，会按现在的规则重新检查。
      </p>
    );
  return null;
}

type QuestionProps = { job: Job; pending: boolean; run: Run; onCancel: () => void };

/** Ending a job: the optional 招到人了吗？ question, then 确定结束招聘. */
function CloseQuestion({ job, pending, run, onCancel }: QuestionProps) {
  return (
    <HiresQuestion
      optional
      submitLabel="确定结束招聘"
      submitClassName={`${ACTION_BUTTON} border-danger text-danger`}
      pending={pending}
      onSubmit={(answer) => run(() => closeMyJob(job.id, answer), closeDoneText(answer))}
      onCancel={onCancel}
    />
  );
}

/** Recording or correcting how many an ended job hired. */
function HiresCorrection({ job, pending, run, onCancel }: QuestionProps) {
  return (
    <HiresQuestion
      initial={job.hiresConfirmed}
      optional={false}
      submitLabel="保存"
      submitClassName={`${ACTION_BUTTON} border-brand text-brand`}
      pending={pending}
      onSubmit={(answer) => answer && run(() => confirmHires(job.id, answer), `已记录，${answerText(answer)}`)}
      onCancel={onCancel}
    />
  );
}

/** Says the new date, since a renewed job may leave the tab it was under (将截止 → 招聘中). */
function renewDoneText(job: Job, now: number, days: number): string {
  return `已续期 ${days} 天，${closeDateZh(renewedExpiry(job, now, days))}截止`;
}

function closeDoneText(answer: HiresAnswer | undefined): string {
  return answer ? `已结束招聘，${answerText(answer)}` : "已结束招聘";
}

const answerText = (answer: HiresAnswer) => hiresLabelZh({ hiresConfirmed: answer.hired ? answer.count : 0 })!;
