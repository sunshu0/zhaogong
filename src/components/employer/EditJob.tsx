"use client";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { CountryCode, Job } from "@/lib/types";
import { editMyJob, getMyJob } from "@/app/employer/actions";
import { DraftEditor } from "@/components/employer/DraftEditor";
import { canEdit } from "@/components/employer/job-status";
import { formFromDraft } from "@/components/employer/post-form";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { CLEAR_OF_STICKY_BARS, holdReason, keepFocusClear, useDraftForm } from "@/components/employer/use-draft-form";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";

/** Loads one of the signed-in employer's jobs and edits it with the same form and checks as posting. */
export function EditJob({ jobId, country }: { jobId: string; country: CountryCode }) {
  return <EmployerGate next={`/employer/jobs/${jobId}`}>{(me) => <Edit jobId={jobId} me={me} country={country} />}</EmployerGate>;
}

function Edit({ jobId, me, country }: { jobId: string; me: EmployerIdentity; country: CountryCode }) {
  const email = me.email;
  const [loaded, setLoaded] = useState<{ email: string; job: Job | null }>();

  useEffect(() => {
    let live = true;
    getMyJob(jobId, email).then((job) => {
      if (live) setLoaded({ email, job });
    });
    return () => {
      live = false;
    };
  }, [jobId, email]);

  if (loaded?.email !== email) return <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />;

  const job = loaded.job;
  if (!job || !canEdit(job)) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">
        {job ? "这个职位已被后台下架，不能修改。" : "找不到这个职位，或者它不属于你登录的店铺。"}
        <Link href="/employer/jobs" className="mt-3 block text-brand underline">
          回到管理职位
        </Link>
      </div>
    );
  }
  return <EditForm key={job.id} job={job} email={email} country={country} />;
}

function EditForm({ job, email, country }: { job: Job; email: string; country: CountryCode }) {
  const state = useDraftForm(country, { form: formFromDraft(job), englishByHand: true });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<Job>();
  const heading = useFocusOnChange<HTMLHeadingElement>(saved?.id);
  const [error, setError] = useState<string>();
  const live = job.status === "active";
  const willReview = live && state.decision.status === "pending_review";

  function save() {
    setError(undefined);
    startTransition(async () => {
      const result = await editMyJob(job.id, email, state.draft);
      if (result.ok) setSaved(result.job);
      else setError(result.error_zh);
      window.scrollTo({ top: 0 });
    });
  }

  if (saved) {
    return (
      <section className="space-y-4">
        <div className={`rounded-xl px-4 py-5 ${saved.status === "pending_review" ? "bg-warn-soft" : "bg-ok-soft"}`}>
          <h1 ref={heading} tabIndex={-1} className={`text-xl font-semibold outline-none ${saved.status === "pending_review" ? "text-warn" : "text-ok"}`}>已保存</h1>
          <p className="mt-1 text-sm">
            {saved.titleZh} · {saved.status === "pending_review" ? "修改的内容需要重新审核，通过后公开。" : "修改已生效。"}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/employer/jobs" className="flex h-11 flex-1 items-center justify-center rounded-xl bg-brand font-medium text-white">
            回到管理职位
          </Link>
          {saved.status === "active" && (
            <Link href={`/jobs/${saved.id}`} className="flex h-11 flex-1 items-center justify-center rounded-xl border border-brand font-medium text-brand">
              查看职位
            </Link>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-lg font-semibold">编辑职位</h1>
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <div onFocus={keepFocusClear} className={`${WIDE_ON_DESKTOP} ${CLEAR_OF_STICKY_BARS}`}>
        <DraftEditor state={state} country={country} />
      </div>
      <div className={`sticky bottom-0 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur ${WIDE_ON_DESKTOP}`}>
        <div className="flex items-center gap-3">
          <Link href="/employer/jobs" className="text-sm text-muted underline">
            取消
          </Link>
          <p className="flex-1 text-xs text-muted">
            {state.ready ? (willReview ? "保存后需要重新审核" : "可以保存") : holdReason(state.findings.length, state.missing.length)}
          </p>
          <button type="button" disabled={!state.ready || pending} onClick={save} className="h-11 rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-40">
            {pending ? "保存中…" : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
