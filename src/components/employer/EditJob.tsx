"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { CountryCode, Job } from "@/lib/types";
import { editMyJob } from "@/app/[lang]/employer/actions";
import { canEdit } from "@/components/employer/job-status";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { CLEAR_OF_STICKY_BARS, holdReason, keepFocusClear } from "@/components/employer/use-draft-form";
import { JobFormPart, KeptChangesNote, useKeptJobForm } from "@/components/employer/KeptJobForm";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { useMyJob } from "@/components/employer/use-my-jobs";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { Button, ButtonLink } from "@/components/ui/Button";
import { BAR_TEXT_ACTION, STICKY_BAR } from "@/components/employer/app-style";
import { SkeletonList } from "@/components/ui/Skeleton";
import { LoadFailed } from "@/components/ui/LoadFailed";
import { employerCommonMessages } from "@/i18n/messages/employer-common";
import { uiMessages } from "@/i18n/messages/ui";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { employerPostMessages } from "@/i18n/messages/employer-post";

/**
 * Loads one of the signed-in employer's jobs and edits it with the same form and checks as posting. Unsaved changes
 * stay in this tab and the form has its own error boundary (#193).
 */
export function EditJob({ jobId, country }: { jobId: string; country: CountryCode }) {
  return (
    <EmployerGate next={`/employer/jobs/${jobId}`}>
      {(me) => <Edit jobId={jobId} me={me} country={country} />}
    </EmployerGate>
  );
}

function Edit({ jobId, me, country }: { jobId: string; me: EmployerIdentity; country: CountryCode }) {
  const t = useMessages(employerPostMessages).edit;
  const names = useMessages(employerCommonMessages).load;
  const email = me.email;
  const { job, failed, reload } = useMyJob(jobId, email);

  if (failed) return <LoadFailed what={names.job} onRetry={reload} />;
  if (job === undefined) return <SkeletonList count={2} />;
  if (!job || !canEdit(job)) {
    return (
      <div className="rounded-card bg-surface px-4 py-8 shadow-card text-center text-body text-muted">
        {job ? t.takenDown : t.notFound}
        <Link href="/employer/jobs" className="mt-3 block text-brand underline">
          {t.backToJobs}
        </Link>
      </div>
    );
  }
  return <EditForm key={job.id} job={job} email={email} country={country} />;
}

function EditForm({ job, email, country }: { job: Job; email: string; country: CountryCode }) {
  const lang = useLang();
  const t = useMessages(employerPostMessages).edit;
  const { profile } = useEmployerProfile(email);
  const { state, restored, startOver, finish } = useKeptJobForm("edit", job, email, country, profile);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<Job>();
  const heading = useFocusOnChange<HTMLHeadingElement>(saved?.id);
  // #202: 放弃改动 takes itself away, so the heading above the form takes the focus.
  const formHeading = useFocusOnChange<HTMLHeadingElement>(restored);
  const [error, setError] = useState<string>();
  // #248: the error shows at the top while the pressed button is in the bar at the foot, so it takes the focus.
  const errorRef = useFocusOnChange<HTMLParagraphElement>(error);
  const noAnswer = useMessages(uiMessages).load.noAnswer;
  const live = job.status === "active";
  const willReview = live && state.decision.status === "pending_review";

  function save() {
    setError(undefined);
    startTransition(async () => {
      // #247: with no answer the form stays as it is and says so.
      const result = await editMyJob(job.id, state.draft).catch(() => null);
      if (result?.ok) {
        finish();
        setSaved(result.job);
      } else setError(result ? result.error_zh : noAnswer);
      window.scrollTo({ top: 0 });
    });
  }

  if (saved) {
    return (
      <section className="space-y-4">
        <div
          className={`animate-pop-in rounded-card px-4 py-5 ${saved.status === "pending_review" ? "bg-warn-soft" : "bg-ok-soft"}`}
        >
          <h1
            ref={heading}
            tabIndex={-1}
            className={`text-title font-semibold outline-none ${saved.status === "pending_review" ? "text-warn" : "text-ok"}`}
          >
            {t.saved}
          </h1>
          <p className="mt-1 text-body">
            <span lang={contentLang(saved.titleZh)}>{saved.titleZh}</span> ·{" "}
            {saved.status === "pending_review" ? t.savedNeedsReview : t.savedLive}
          </p>
        </div>
        <div className="flex gap-3">
          <ButtonLink href="/employer/jobs" size="lg" className="flex-1">
            {t.backToJobs}
          </ButtonLink>
          {saved.status === "active" && (
            <ButtonLink href={`/jobs/${saved.id}`} variant="secondary" size="lg" className="flex-1">
              {t.seeJob}
            </ButtonLink>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <h1 ref={formHeading} tabIndex={-1} className="text-title font-semibold outline-none">
        {t.heading}
      </h1>
      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger outline-none"
        >
          {error}
        </p>
      )}
      {restored && <KeptChangesNote onStartOver={startOver} />}
      <div onFocus={keepFocusClear} className={`${WIDE_ON_DESKTOP} ${CLEAR_OF_STICKY_BARS}`}>
        <JobFormPart state={state} country={country} />
      </div>
      <div className={`${STICKY_BAR} ${WIDE_ON_DESKTOP}`}>
        <div className="flex items-center gap-3">
          <Link href="/employer/jobs" className={BAR_TEXT_ACTION}>
            {t.cancel}
          </Link>
          <p className="flex-1 text-meta text-muted">
            {state.ready
              ? willReview
                ? t.readyNeedsReview
                : t.ready
              : holdReason(state.findings.length, state.missing.length, lang)}
          </p>
          <Button size="lg" loading={pending} disabled={!state.ready} onClick={save} className="px-6">
            {pending ? t.saving : t.save}
          </Button>
        </div>
      </div>
    </div>
  );
}
