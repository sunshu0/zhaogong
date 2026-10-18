"use client";

// 编辑职位, 重新发布 and 复制为新职位 (#193): the form kept in this tab while it is being changed, and the form in its own
// error boundary, as the posting page does (#178). The form's state lives in useKeptJobForm, outside the boundary,
// so 重试 redraws the form with every change still there.
import { useEffect, useMemo, useState } from "react";
import type { CountryCode, Employer, Job } from "@/lib/types";
import { DraftEditor } from "@/components/employer/DraftEditor";
import { formFromDraft } from "@/components/employer/post-form";
import { useDraftForm, type DraftFormState } from "@/components/employer/use-draft-form";
import { clearJobForm, loadJobForm, saveJobForm, type JobDraftKind } from "@/components/employer/job-draft-store";
import { noticeClass } from "@/components/employer/app-style";
import { RetryBoundary } from "@/components/seeker/RetryBoundary";
import { useMessages } from "@/i18n/client";
import { employerPostMessages } from "@/i18n/messages/employer-post";
import { crashForTests } from "@/lib/test-crash";

/**
 * The form for one of the business's jobs, starting from what this tab kept for this page and job, else from the
 * job. `restored` says it picked up kept changes; `startOver` goes back to the job; `finished` after saving or
 * publishing, when nothing is to be kept any more.
 */
export function useKeptJobForm(
  kind: JobDraftKind,
  job: Job,
  email: string,
  country: CountryCode,
  employer?: Pick<Employer, "verification">,
) {
  const original = useMemo(() => formFromDraft(job), [job]);
  // The page renders in the browser only (EmployerGate waits for the session), so this tab's storage is there.
  const [kept] = useState(() => loadJobForm(sessionStorage, kind, job.id, email));
  const [restored, setRestored] = useState(!!kept);
  const [finished, setFinished] = useState(false);
  const state = useDraftForm(
    country,
    { form: kept?.form ?? original, englishByHand: kept?.englishByHand ?? true },
    employer,
  );

  useEffect(() => {
    if (finished) return clearJobForm(sessionStorage, kind, job.id);
    saveJobForm(
      sessionStorage,
      kind,
      job.id,
      { email, form: state.form, englishByHand: state.englishByHand },
      original,
    );
  }, [finished, kind, job.id, email, state.form, state.englishByHand, original]);

  return {
    state,
    restored,
    startOver() {
      setRestored(false);
      state.reset(original, false);
    },
    finish() {
      setFinished(true);
    },
  };
}

/** The line that says the form picked up kept changes, with 放弃改动. */
export function KeptChangesNote({ onStartOver }: { onStartOver: () => void }) {
  const t = useMessages(employerPostMessages).keptForm;
  return (
    <p role="status" className={`${noticeClass(true)} flex flex-wrap items-center justify-between gap-2`}>
      {t.restored}
      <button type="button" onClick={onStartOver} className="pressable min-h-11 underline">
        {t.discard}
      </button>
    </p>
  );
}

/** The form in its own error boundary: if it fails, only it shows 重试, and the changes are kept. */
export function JobFormPart({ state, country }: { state: DraftFormState; country: CountryCode }) {
  const t = useMessages(employerPostMessages).keptForm;
  return (
    <RetryBoundary title={t.failedTitle} note={t.failedNote}>
      <JobForm state={state} country={country} />
    </RetryBoundary>
  );
}

function JobForm({ state, country }: { state: DraftFormState; country: CountryCode }) {
  crashForTests("job-form");
  return <DraftEditor state={state} country={country} />;
}
