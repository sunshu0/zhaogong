"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { reportJob } from "@/app/[lang]/jobs/[id]/actions";
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
import { useLang, useMessages } from "@/i18n/client";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";

/** "举报这个职位" → reasons + optional note → thank-you. */
export function ReportJob({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const owner = useSession();
  // The session is read after hydration; until then the button waits, so an early tap is not lost when the
  // form starts over for the signed-in identity.
  if (!useHydrated()) return <ClosedReport disabled />;
  return <ReportForm key={identityScope(owner)} jobId={jobId} jobTitle={jobTitle} owner={owner} />;
}

function ClosedReport({ disabled = false, onOpen }: { disabled?: boolean; onOpen?: () => void }) {
  const t = useMessages(seekerJobsMessages).report;
  return (
    <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted">
      <span>{t.prompt}</span>
      <Button variant="danger-secondary" disabled={disabled} onClick={onOpen}>
        {t.open}
      </Button>
    </div>
  );
}

function ReportForm({ jobId, jobTitle, owner }: { jobId: string; jobTitle: string; owner: DemoSession | null }) {
  const [state, setState] = useState<"closed" | "open" | "sent">("closed");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const lang = useLang();
  const t = useMessages(seekerJobsMessages).report;
  const thanks = useRef<HTMLElement>(null);
  // The form and its buttons go away: the focus goes to the thanks (#202).
  useEffect(() => {
    if (state === "sent") thanks.current?.focus();
  }, [state]);
  const reportedBefore = useSentReports().some((r) => r.jobId === jobId);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const reason = String(data.get("reason") ?? "");
    const note = String(data.get("note") ?? "");
    const parsed = parseReport({ reason, note }, lang);
    if (!parsed.ok) return setError(parsed.error);
    setError(null);
    startTransition(async () => {
      const result = await reportJob(jobId, parsed.reason, parsed.note).catch(() => null);
      if (!result) return setError(t.networkError);
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
      <section ref={thanks} tabIndex={-1} role="status" className="rounded-card bg-ok-soft p-4 outline-none lg:p-5">
        <h2 className="font-medium text-ok">{t.thanks}</h2>
        <p className="mt-1 text-sm">{t.thanksDetail}</p>
        <p className="mt-2 text-xs text-muted">
          {t.seeBefore}
          <Link href="/me" className="mx-0.5 underline underline-offset-2">
            {t.seeLink}
          </Link>
          {t.seeAfter}
        </p>
      </section>
    );
  }

  if (state === "closed") {
    return reportedBefore ? (
      <p className="px-1 text-sm text-muted">{t.already}</p>
    ) : (
      <ClosedReport onOpen={() => setState("open")} />
    );
  }

  return (
    <form onSubmit={submit} noValidate className={cardClass()}>
      <fieldset>
        <legend className="font-medium">{t.legend}</legend>
        <p className="mt-1 text-sm text-muted">{t.hint}</p>
        <div className="mt-3 space-y-1">
          {REPORT_REASONS.map((reason) => (
            <Radio key={reason} name="reason" value={reason}>
              {REPORT_REASON_LABELS[reason][lang]}
            </Radio>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block">
        <span className="mb-1 block text-sm">{t.note}</span>
        <textarea
          name="note"
          rows={3}
          maxLength={NOTE_MAX}
          placeholder={t.notePlaceholder}
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
          {t.cancel}
        </Button>
        <Button type="submit" variant="danger" loading={pending} className="flex-[2]">
          {t.submit}
        </Button>
      </div>
    </form>
  );
}
