"use client";
import { useState, useTransition } from "react";
import { regionById } from "@/config/countries";
import type { Employer, Job } from "@/lib/types";
import { closeMyJob, confirmHires, type ChangeResult } from "@/app/employer/actions";
import {
  canEdit,
  effectiveStatus,
  expiryLabelZh,
  STATUS_LABELS,
  type ShownStatus,
} from "@/components/employer/job-status";
import { hiresLabelZh, type HiresAnswer } from "@/components/employer/hires";
import { HiresQuestion } from "@/components/employer/HiresQuestion";
import { ACTION_BUTTON, JobActions, type Asking, type Run } from "@/components/employer/ManagedJobActions";
import { ShareTexts } from "@/components/employer/ShareTexts";
import { formatPay } from "@/components/seeker/format";

/** Tells the list what happened, with the text to show when it worked. */
export type JobChangeDone = (result: ChangeResult, okText: string) => void;

/** One of the employer's jobs: what it is, where it stands, and what can be done with it. */
export function ManagedJob({
  job,
  employer,
  email,
  views,
  now,
  onDone,
}: {
  job: Job;
  employer?: Employer;
  email: string;
  views: number;
  now: number;
  onDone: JobChangeDone;
}) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<Asking>();
  const [sharing, setSharing] = useState(false);
  const status = effectiveStatus(job, now);

  const run: Run = (action, okText) =>
    startTransition(async () => {
      onDone(await action(), okText);
      setAsking(undefined);
    });

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <JobSummary job={job} status={status} views={views} now={now} />
      <StatusNote status={status} />
      {canEdit(job) && (
        <JobActions
          job={job}
          status={status}
          now={now}
          email={email}
          pending={pending}
          asking={asking}
          sharing={sharing}
          run={run}
          onAsk={setAsking}
          onToggleShare={() => setSharing((s) => !s)}
        />
      )}
      {asking === "close" && (
        <CloseQuestion job={job} email={email} pending={pending} run={run} onCancel={() => setAsking(undefined)} />
      )}
      {asking === "hires" && (
        <HiresCorrection job={job} email={email} pending={pending} run={run} onCancel={() => setAsking(undefined)} />
      )}
      {sharing && status === "active" && (
        <div className="mt-3">
          <ShareTexts job={job} employer={employer} />
        </div>
      )}
    </article>
  );
}

function JobSummary({ job, status, views, now }: { job: Job; status: ShownStatus; views: number; now: number }) {
  const label = STATUS_LABELS[status];
  const hires = hiresLabelZh(job);
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold leading-snug">{job.titleZh}</h2>
          <p className="truncate text-xs text-muted">
            {job.titleEn} · {regionById(job.country, job.regionId)?.nameZh}
          </p>
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${label.className}`}>{label.zh}</span>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <span className="font-medium text-brand">{formatPay(job.pay, job.country)}</span>
        <span className="text-muted">{expiryLabelZh(job, now)}</span>
        <span className="text-muted">{views} 人查看了联系方式</span>
        {hires && <span className="font-medium text-ok">{hires}</span>}
      </p>
    </>
  );
}

/** Why a job is not live, when it is not. */
function StatusNote({ status }: { status: ShownStatus }) {
  if (status === "removed")
    return <p className="mt-2 text-sm text-danger">这个职位已被后台下架。如有疑问请联系我们。</p>;
  if (status === "pending_review") return <p className="mt-2 text-sm text-warn">审核通过后才会公开。</p>;
  return null;
}

type QuestionProps = { job: Job; email: string; pending: boolean; run: Run; onCancel: () => void };

/** Ending a job: the optional 招到人了吗？ question, then 确定结束招聘. */
function CloseQuestion({ job, email, pending, run, onCancel }: QuestionProps) {
  return (
    <HiresQuestion
      optional
      submitLabel="确定结束招聘"
      submitClassName={`${ACTION_BUTTON} border-danger text-danger`}
      pending={pending}
      onSubmit={(answer) => run(() => closeMyJob(job.id, email, answer), closeDoneText(answer))}
      onCancel={onCancel}
    />
  );
}

/** Recording or correcting how many an ended job hired. */
function HiresCorrection({ job, email, pending, run, onCancel }: QuestionProps) {
  return (
    <HiresQuestion
      initial={job.hiresConfirmed}
      optional={false}
      submitLabel="保存"
      submitClassName={`${ACTION_BUTTON} border-brand text-brand`}
      pending={pending}
      onSubmit={(answer) => answer && run(() => confirmHires(job.id, email, answer), `已记录，${answerText(answer)}`)}
      onCancel={onCancel}
    />
  );
}

function closeDoneText(answer: HiresAnswer | undefined): string {
  return answer ? `已结束招聘，${answerText(answer)}` : "已结束招聘";
}

const answerText = (answer: HiresAnswer) => hiresLabelZh({ hiresConfirmed: answer.hired ? answer.count : 0 })!;
