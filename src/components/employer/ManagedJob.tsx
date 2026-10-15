"use client";
import { useState, useTransition } from "react";
import { regionById } from "@/config/countries";
import type { Employer, Job } from "@/lib/types";
import { closeMyJob, confirmHires, type ChangeResult } from "@/app/employer/actions";
import { canEdit, effectiveStatus, expiryLabelZh, type ShownStatus } from "@/components/employer/job-status";
import { hiresLabelZh, type HiresAnswer } from "@/components/employer/hires";
import { HiresQuestion } from "@/components/employer/HiresQuestion";
import { ACTION_BUTTON, JobActions, type Asking, type Run } from "@/components/employer/ManagedJobActions";
import { ShareTexts } from "@/components/employer/ShareTexts";
import { cardNumbers } from "@/components/employer/job-card";
import { Figures, StatusTag } from "@/components/employer/StatusTag";
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
  views,
  chats,
  now,
  onDone,
}: {
  job: Job;
  employer?: Employer;
  views: number;
  /** People who chatted about this job. */
  chats: number;
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
    <article className="py-4">
      <JobSummary job={job} status={status} views={views} chats={chats} now={now} />
      <StatusNote status={status} />
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
  status,
  views,
  chats,
  now,
}: {
  job: Job;
  status: ShownStatus;
  views: number;
  chats: number;
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
          <StatusTag status={status} />
          <p className="leading-none">
            <Pay pay={job.pay} country={job.country} />
          </p>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body text-muted">
        <span>
          <Figures>{expiryLabelZh(job, now)}</Figures>
        </span>
        {cardNumbers(job, chats, views).map((n) => (
          <span key={n}>
            <Figures>{n}</Figures>
          </span>
        ))}
        {hires && <span className="font-medium text-ok">{hires}</span>}
      </p>
    </>
  );
}

/** Why a job is not live, when it is not. */
function StatusNote({ status }: { status: ShownStatus }) {
  if (status === "removed")
    return <p className="mt-2 text-body text-danger">这个职位已被后台下架。如有疑问请联系我们。</p>;
  if (status === "pending_review") return <p className="mt-2 text-body text-warn">审核通过后才会公开。</p>;
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

function closeDoneText(answer: HiresAnswer | undefined): string {
  return answer ? `已结束招聘，${answerText(answer)}` : "已结束招聘";
}

const answerText = (answer: HiresAnswer) => hiresLabelZh({ hiresConfirmed: answer.hired ? answer.count : 0 })!;
