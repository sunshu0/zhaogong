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
  const email = me.email;
  const job = useMyJob(jobId, email);

  if (job === undefined) return <SkeletonList count={2} />;
  if (!job || !canEdit(job)) {
    return (
      <div className="rounded-card bg-surface px-4 py-8 shadow-card text-center text-body text-muted">
        {job ? "这个职位已被后台下架，不能修改。" : "找不到这个职位，或者它不属于你登录的店铺。"}
        <Link href="/employer/jobs" className="mt-3 block text-brand underline">
          回到职位管理
        </Link>
      </div>
    );
  }
  return <EditForm key={job.id} job={job} email={email} country={country} />;
}

function EditForm({ job, email, country }: { job: Job; email: string; country: CountryCode }) {
  const { profile } = useEmployerProfile(email);
  const { state, restored, startOver, finish } = useKeptJobForm("edit", job, email, country, profile);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<Job>();
  const heading = useFocusOnChange<HTMLHeadingElement>(saved?.id);
  const [error, setError] = useState<string>();
  const live = job.status === "active";
  const willReview = live && state.decision.status === "pending_review";

  function save() {
    setError(undefined);
    startTransition(async () => {
      const result = await editMyJob(job.id, state.draft);
      if (result.ok) {
        finish();
        setSaved(result.job);
      } else setError(result.error_zh);
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
            已保存
          </h1>
          <p className="mt-1 text-body">
            {saved.titleZh} ·{" "}
            {saved.status === "pending_review" ? "修改的内容需要重新审核，通过后公开。" : "修改已生效。"}
          </p>
        </div>
        <div className="flex gap-3">
          <ButtonLink href="/employer/jobs" size="lg" className="flex-1">
            回到职位管理
          </ButtonLink>
          {saved.status === "active" && (
            <ButtonLink href={`/jobs/${saved.id}`} variant="secondary" size="lg" className="flex-1">
              查看职位
            </ButtonLink>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-title font-semibold">编辑职位</h1>
      {error && <p className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger">{error}</p>}
      {restored && <KeptChangesNote onStartOver={startOver} />}
      <div onFocus={keepFocusClear} className={`${WIDE_ON_DESKTOP} ${CLEAR_OF_STICKY_BARS}`}>
        <JobFormPart state={state} country={country} />
      </div>
      <div className={`${STICKY_BAR} ${WIDE_ON_DESKTOP}`}>
        <div className="flex items-center gap-3">
          <Link href="/employer/jobs" className={BAR_TEXT_ACTION}>
            取消
          </Link>
          <p className="flex-1 text-meta text-muted">
            {state.ready
              ? willReview
                ? "保存后需要重新审核"
                : "可以保存"
              : holdReason(state.findings.length, state.missing.length)}
          </p>
          <Button size="lg" loading={pending} disabled={!state.ready} onClick={save} className="px-6">
            {pending ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    </div>
  );
}
