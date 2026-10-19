"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CountryCode, Job } from "@/lib/types";
import { publishJob } from "@/app/[lang]/employer/actions";
import { canCopy, canRepublish } from "@/components/employer/job-status";
import { publishError } from "@/components/employer/post-flow-state";
import { Published } from "@/components/employer/Published";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { CLEAR_OF_STICKY_BARS, holdReason, keepFocusClear } from "@/components/employer/use-draft-form";
import { JobFormPart, KeptChangesNote, useKeptJobForm } from "@/components/employer/KeptJobForm";
import { DuplicateJobNote } from "@/components/employer/DuplicateJobNote";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { useMyJob } from "@/components/employer/use-my-jobs";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { Button } from "@/components/ui/Button";
import { BAR_TEXT_ACTION, STICKY_BAR } from "@/components/employer/app-style";
import { SkeletonList } from "@/components/ui/Skeleton";
import { LoadFailed } from "@/components/ui/LoadFailed";
import { employerCommonMessages } from "@/i18n/messages/employer-common";
import { uiMessages } from "@/i18n/messages/ui";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { contentLang } from "@/i18n/lang";
import { employerPostMessages } from "@/i18n/messages/employer-post";

const BOX = "rounded-card bg-surface px-4 py-8 shadow-card text-center text-body text-muted";

/**
 * 重新发布 (#69): a job that closed more than 14 days ago, as a new draft with its content; 复制为新职位 (#190): the
 * same for a live or ended job. Both go through the same form and checks as posting — the rules of today, such as
 * the minimum wage — and publish a new job, with no applicants, renewals or numbers of the old one, posted by whoever
 * publishes it (#182). The old job stays as it was.
 */
export type CopyMode = "republish" | "copy";

export function RepublishJob({
  jobId,
  country,
  mode = "republish",
}: {
  jobId: string;
  country: CountryCode;
  mode?: CopyMode;
}) {
  return (
    <EmployerGate next={`/employer/jobs/${jobId}/${mode}`}>
      {(me) => <Load jobId={jobId} me={me} country={country} mode={mode} />}
    </EmployerGate>
  );
}

function Load({
  jobId,
  me,
  country,
  mode,
}: {
  jobId: string;
  me: EmployerIdentity;
  country: CountryCode;
  mode: CopyMode;
}) {
  const t = useMessages(employerPostMessages).republish;
  const names = useMessages(employerCommonMessages).load;
  const { job, failed, reload } = useMyJob(jobId, me.email);
  // The time the page opened decides whether the job may be published again; it stays fixed while the form is open.
  const [openedAt] = useState(() => Date.now());

  if (failed) return <LoadFailed what={names.job} onRetry={reload} />;
  if (job === undefined) return <SkeletonList count={2} />;
  const allowed = job && (mode === "copy" ? canCopy(job) : canRepublish(job, openedAt));
  if (!job || !allowed) {
    return (
      <div className={BOX}>
        {!job ? t.notFound : mode === "copy" ? t.cannotCopy : t.cannotRepublish}
        <Link href="/employer/jobs" className="mt-3 block text-brand underline">
          {t.backToJobs}
        </Link>
      </div>
    );
  }
  return <RepublishForm key={job.id} job={job} email={me.email} country={country} mode={mode} />;
}

function RepublishForm({
  job,
  email,
  country,
  mode,
}: {
  job: Job;
  email: string;
  country: CountryCode;
  mode: CopyMode;
}) {
  const lang = useLang();
  const t = useMessages(employerPostMessages).republish;
  const router = useRouter();
  const { profile } = useEmployerProfile(email);
  const { state, restored, startOver, finish } = useKeptJobForm(mode, job, email, country, profile);
  const [pending, startTransition] = useTransition();
  const [published, setPublished] = useState<Job>();
  const heading = useFocusOnChange<HTMLHeadingElement>(published?.id);
  // #202: 放弃改动 takes itself away, so the heading above the form takes the focus.
  const formHeading = useFocusOnChange<HTMLHeadingElement>(restored);
  const [error, setError] = useState<string>();
  // #248: the error shows at the top while the pressed button is in the bar at the foot, so it takes the focus.
  const errorRef = useFocusOnChange<HTMLParagraphElement>(error);
  const noAnswer = useMessages(uiMessages).load.noAnswer;

  function publish() {
    setError(undefined);
    startTransition(async () => {
      // #247: with no answer the form stays as it is and says so.
      const result = await publishJob(state.draft).catch(() => null);
      if (result?.ok) {
        finish();
        setPublished(result.job);
      } else setError(result ? publishError(result.reason, lang) : noAnswer);
      window.scrollTo({ top: 0 });
    });
  }

  if (published) {
    return (
      <Published
        job={published}
        employer={profile ?? undefined}
        headingRef={heading}
        onAgain={() => router.push("/employer/post")}
      />
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 ref={formHeading} tabIndex={-1} className="text-title font-semibold outline-none">
          {mode === "copy" ? t.copyHeading : t.republishHeading}
        </h1>
        {/* The job's title is the employer's own, so it says which language it is in (ADR 0023 §6). */}
        <p className="mt-1 text-body text-muted">
          {mode === "copy" ? t.copyNoteBefore : t.republishNoteBefore}
          <span lang={contentLang(job.titleZh)}>{job.titleZh}</span>
          {mode === "copy"
            ? t.copyNoteAfter
            : t.republishNoteAfter(formatDate(job.expiresAt, lang, { month: "long", day: "numeric" }))}
        </p>
      </div>
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
      <DuplicateJobNote titleZh={state.form.titleZh} />
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
              ? state.decision.status === "pending_review"
                ? t.readyNeedsReview
                : t.ready
              : holdReason(state.findings.length, state.missing.length, lang)}
          </p>
          <Button size="lg" loading={pending} disabled={!state.ready} onClick={publish} className="px-6">
            {pending ? t.publishing : t.publish}
          </Button>
        </div>
      </div>
    </div>
  );
}
