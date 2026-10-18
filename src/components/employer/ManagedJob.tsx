"use client";
import { useState, useTransition } from "react";
import { regionById } from "@/config/countries";
import type { Employer, Job } from "@/lib/types";
import { jobRoles } from "@/lib/job-roles";
import { closeMyJob, confirmHires, renewMyJob, type ChangeResult } from "@/app/[lang]/employer/actions";
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
import { staleContactNote, type JobPoster } from "@/components/employer/job-poster";
import { Pay } from "@/components/ui/Pay";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang, type Lang } from "@/i18n/lang";
import { pick, type Messages } from "@/i18n/messages";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";

type Words = Messages<typeof employerJobsMessages.zh>;

/** The job's area in the interface language (Round 20); most areas read the same in both. */
function regionName(job: Job, lang: Lang): string | undefined {
  const region = regionById(job.country, job.regionId);
  return region && (lang === "en" ? region.nameEn : region.nameZh);
}

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
  poster,
  contactFrom,
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
  /** Who posted it, e.g. 小李发布 (#182); null when not worth saying. */
  poster?: string | null;
  /** Someone no longer in the team, when the job shows contact details they filled (#186). */
  contactFrom?: Extract<JobPoster, { kind: "left" | "deleted" }>;
  now: number;
  onDone: JobChangeDone;
}) {
  const lang = useLang();
  const t = useMessages(employerJobsMessages);
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<Asking>();
  const [sharing, setSharing] = useState(false);
  const status = effectiveStatus(job, now);
  const phase = jobPhase(job, now);
  const staleContact = staleContactNote(contactFrom, phase, lang);

  const run: Run = (action, okText) =>
    startTransition(async () => {
      onDone(await action(), okText);
      setAsking(undefined);
    });

  return (
    <article className="py-4">
      <JobSummary
        job={job}
        phase={phase}
        numbers={numbers}
        renewals={renewals}
        applications={applications}
        poster={poster}
        now={now}
      />
      {staleContact && (
        // #186: only the team sees this; the job's public page never says who left.
        <p className="mt-2 text-body text-warn">
          {staleContact}
          <Link href={`/employer/jobs/${job.id}`} className="ml-1 font-medium text-brand underline underline-offset-4">
            {t.job.editContact}
          </Link>
        </p>
      )}
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
          onSubmit={(days) => run(() => renewMyJob(job.id, days), renewDoneText(job, now, days, lang))}
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
  poster,
  now,
}: {
  job: Job;
  phase: Phase;
  numbers: JobNumbers;
  renewals?: RenewalCounts[string];
  applications?: ApplicationCount;
  poster?: string | null;
  now: number;
}) {
  const lang = useLang();
  const t = useMessages(employerJobsMessages);
  const hires = hiresLabelZh(job, lang);
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 lang={contentLang(job.titleZh)} className="break-words text-subtitle font-semibold">
            {job.titleZh}
          </h2>
          <p className="truncate text-meta text-muted">
            {/* The English title is the employer's own: Latin text is English, but they may have typed Chinese. */}
            <span lang={contentLang(job.titleEn) ?? "en"} className="font-latin">
              {job.titleEn}
            </span>{" "}
            · {regionName(job, lang)}
          </p>
          {poster && <p className="text-meta text-muted">{poster}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <PhaseTag phase={phase} />
          <p className="leading-none">
            <Pay pay={job.pay} country={job.country} lang={lang} />
          </p>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body text-muted">
        <span>
          <Figures>{expiryLabelZh(job, now, lang)}</Figures>
        </span>
        {cardNumbers(job, numbers, lang).map((n) => (
          <span key={n}>
            <Figures>{n}</Figures>
          </span>
        ))}
        <Link href={`/employer/jobs/${job.id}/stats`} className="text-brand underline-offset-4 hover:underline">
          {t.job.last14Days}
        </Link>
        {/* #84: who applied; the list marks them seen. */}
        <Link href={`/employer/jobs/${job.id}/applicants`} className="text-brand underline-offset-4 hover:underline">
          <Figures>{applicantsLabelZh(applications, lang)}</Figures>
        </Link>
        {renewals && (
          <span>
            <Figures>{t.job.renewedTimes(renewals.count)}</Figures>
          </span>
        )}
        {hires && <span className="font-medium text-ok">{hires}</span>}
      </p>
      {/* #96: a job from before 岗位类别 whose title named none is 待选 until the employer picks. */}
      {phase !== "removed" && jobRoles(job).length === 0 && (
        <p className="mt-2 text-body text-warn">
          {t.job.rolesTodo}
          <Link href={`/employer/jobs/${job.id}`} className="ml-1 font-medium text-brand underline underline-offset-4">
            {t.job.rolesPick}
          </Link>
        </p>
      )}
    </>
  );
}

/**
 * Why a job is not live, when it is not; and from 3 days before it closes, that it is closing and can be renewed
 * (#69), with the button right there.
 */
function StatusNote({ job, phase, now, onRenew }: { job: Job; phase: Phase; now: number; onRenew?: () => void }) {
  const lang = useLang();
  const t = useMessages(employerJobsMessages).job;
  if (phase === "removed") return <p className="mt-2 text-body text-danger">{t.takenDown}</p>;
  if (phase === "pending_review") return <p className="mt-2 text-body text-warn">{t.pendingReview}</p>;
  if (phase === "ending" || (phase === "timed_out" && renewDaysLeft(job, now) > 0)) {
    const closeDate = closeDateZh(job.expiresAt, lang);
    const text = phase === "ending" ? t.endingNote(closeDate) : t.timedOutNote(closeDate, renewDaysLeft(job, now));
    return (
      <p className="mt-2 text-body text-warn">
        {text}
        {onRenew && (
          <button type="button" onClick={onRenew} className="ml-1 font-medium text-brand underline underline-offset-4">
            {t.renew}
          </button>
        )}
      </p>
    );
  }
  if (canRepublish(job, now))
    return (
      <p className="mt-2 text-body text-muted">
        {t.republishNoteStart}
        <Link href={`/employer/jobs/${job.id}/republish`} className="mx-1 text-brand underline underline-offset-4">
          {t.republishNoteLink}
        </Link>
        {t.republishNoteEnd}
      </p>
    );
  return null;
}

type QuestionProps = { job: Job; pending: boolean; run: Run; onCancel: () => void };

/** Ending a job: the optional 招到人了吗？ question, then 确定结束招聘. */
function CloseQuestion({ job, pending, run, onCancel }: QuestionProps) {
  const lang = useLang();
  const t = useMessages(employerJobsMessages);
  return (
    <HiresQuestion
      optional
      submitLabel={t.job.closeSubmit}
      submitClassName={`${ACTION_BUTTON} border-danger text-danger`}
      pending={pending}
      onSubmit={(answer) => run(() => closeMyJob(job.id, answer), closeDoneText(answer, t, lang))}
      onCancel={onCancel}
    />
  );
}

/** Recording or correcting how many an ended job hired. */
function HiresCorrection({ job, pending, run, onCancel }: QuestionProps) {
  const lang = useLang();
  const t = useMessages(employerJobsMessages);
  return (
    <HiresQuestion
      initial={job.hiresConfirmed}
      optional={false}
      submitLabel={t.job.hiresSubmit}
      submitClassName={`${ACTION_BUTTON} border-brand text-brand`}
      pending={pending}
      onSubmit={(answer) =>
        answer && run(() => confirmHires(job.id, answer), t.job.hiresDone(answerText(answer, lang)))
      }
      onCancel={onCancel}
    />
  );
}

/** Says the new date, since a renewed job may leave the tab it was under (将截止 → 招聘中). */
function renewDoneText(job: Job, now: number, days: number, lang: Lang): string {
  const t = pick(employerJobsMessages, lang).job;
  return t.renewDone(days, closeDateZh(renewedExpiry(job, now, days), lang));
}

function closeDoneText(answer: HiresAnswer | undefined, t: Words, lang: Lang): string {
  return answer ? t.job.closeDoneWithHires(answerText(answer, lang)) : t.job.closeDone;
}

const answerText = (answer: HiresAnswer, lang: Lang) =>
  hiresLabelZh({ hiresConfirmed: answer.hired ? answer.count : 0 }, lang)!;
