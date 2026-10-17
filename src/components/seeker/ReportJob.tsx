"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { reportJob } from "@/app/jobs/[id]/actions";
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import { rememberReport, useSentReports } from "@/components/seeker/activity-client";
import { NOTE_MAX, parseReport, REPORT_REASONS } from "@/components/seeker/report";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { identityScope } from "@/components/seeker/identity-scope";
import type { DemoSession } from "@/components/seeker/session";
import { Button } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Radio } from "@/components/ui/Checkbox";
import { inputClass } from "@/components/ui/input-class";

/** "举报这个职位" → reasons + optional note → thank-you. */
export function ReportJob({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const owner = useSession();
  // The session is read after hydration; until then the button waits, so an early tap is not lost when the
  // form starts over for the signed-in identity.
  if (!useHydrated()) return <ClosedReport disabled />;
  return <ReportForm key={identityScope(owner)} jobId={jobId} jobTitle={jobTitle} owner={owner} />;
}

function ClosedReport({ disabled = false, onOpen }: { disabled?: boolean; onOpen?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted">
      <span>职位信息有问题？</span>
      <Button variant="danger-secondary" disabled={disabled} onClick={onOpen}>
        举报这个职位
      </Button>
    </div>
  );
}

function ReportForm({ jobId, jobTitle, owner }: { jobId: string; jobTitle: string; owner: DemoSession | null }) {
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
      rememberReport(
        { reportId: result.reportId, jobId, jobTitle, reason: parsed.reason, at: new Date().toISOString() },
        owner,
      );
      setState("sent");
    });
  }

  if (state === "sent") {
    return (
      <section role="status" className="rounded-card bg-ok-soft p-4 lg:p-5">
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
    return reportedBefore ? (
      <p className="px-1 text-sm text-muted">你已经举报过这个职位，我们会尽快核查。</p>
    ) : (
      <ClosedReport onOpen={() => setState("open")} />
    );
  }

  return (
    <form onSubmit={submit} noValidate className={cardClass()}>
      <fieldset>
        <legend className="font-medium">举报这个职位</legend>
        <p className="mt-1 text-sm text-muted">请选择最符合的原因。举报不会告诉雇主是谁发的。</p>
        <div className="mt-3 space-y-1">
          {REPORT_REASONS.map((reason) => (
            <Radio key={reason} name="reason" value={reason}>
              {REPORT_REASON_LABELS[reason].zh}
            </Radio>
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
          className={inputClass({ multiline: true })}
        />
      </label>

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={() => {
            setState("closed");
            setError(null);
          }}
        >
          取消
        </Button>
        <Button type="submit" variant="danger" loading={pending} className="flex-[2]">
          提交举报
        </Button>
      </div>
    </form>
  );
}
