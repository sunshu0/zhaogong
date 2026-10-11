"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { reportJob } from "@/app/jobs/[id]/actions";
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import { rememberReport, useSentReports } from "@/components/seeker/activity-client";
import { NOTE_MAX, parseReport, REPORT_REASONS } from "@/components/seeker/report";

/** "举报这个职位" → reasons + optional note → thank-you. */
export function ReportJob({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [state, setState] = useState<"closed" | "open" | "sent">("closed");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reportedBefore = useSentReports().some((r) => r.jobId === jobId);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const reason = String(data.get("reason") ?? "");
    const note = String(data.get("note") ?? "");
    const parsed = parseReport({ reason, note });
    if (!parsed.ok) return setError(parsed.error);
    setError(null);
    startTransition(async () => {
      const result = await reportJob(jobId, parsed.reason, parsed.note).catch(() => null);
      if (!result) return setError("网络有问题，举报没有发出，请稍后再试");
      if (!result.ok) return setError(result.error);
      rememberReport({ reportId: result.reportId, jobId, jobTitle, reason: parsed.reason, at: new Date().toISOString() });
      setState("sent");
    });
  }

  if (state === "sent") {
    return (
      <section role="status" className="rounded-xl border border-ok/30 bg-ok-soft p-4">
        <h2 className="font-medium text-ok">谢谢你的举报</h2>
        <p className="mt-1 text-sm">我们会尽快核查这个职位。在此之前，如果雇主要求你付钱或交出证件，请不要照做。</p>
        <p className="mt-2 text-xs text-muted">
          发出的举报可以在
          <Link href="/me" className="mx-0.5 underline underline-offset-2">
            「我的」
          </Link>
          里看到。
        </p>
      </section>
    );
  }

  if (state === "closed") {
    return (
      <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted">
        {reportedBefore ? (
          <span>你已经举报过这个职位，我们会尽快核查。</span>
        ) : (
          <>
            <span>职位信息有问题？</span>
            <button
              type="button"
              onClick={() => setState("open")}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-danger hover:border-danger"
            >
              举报这个职位
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="rounded-xl border border-border bg-surface p-4">
      <fieldset>
        <legend className="font-medium">举报这个职位</legend>
        <p className="mt-1 text-sm text-muted">请选择最符合的原因。举报不会告诉雇主是谁发的。</p>
        <div className="mt-3 space-y-1">
          {REPORT_REASONS.map((reason) => (
            <label key={reason} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-background">
              <input type="radio" name="reason" value={reason} className="size-4 accent-brand" />
              <span className="text-sm">{REPORT_REASON_LABELS[reason].zh}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm">补充说明（选填）</span>
        <textarea
          name="note"
          rows={3}
          maxLength={NOTE_MAX}
          placeholder="例如：电话里要求先交 200 元押金"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-base outline-none focus:border-brand"
        />
      </label>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setState("closed");
            setError(null);
          }}
          className="flex-1 rounded-lg border border-border px-3 py-2.5 text-sm"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={pending}
          className="flex-[2] rounded-lg bg-danger px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "正在提交…" : "提交举报"}
        </button>
      </div>
    </form>
  );
}
