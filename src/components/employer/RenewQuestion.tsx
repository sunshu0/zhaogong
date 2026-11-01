"use client";
import { useId, useState } from "react";
import type { Job } from "@/lib/types";
import {
  closeDateZh,
  DEFAULT_RENEW_DAYS,
  LATEST_CLOSE_DAYS,
  renewState,
  type RenewDays,
} from "@/components/employer/job-status";
import { CHOICE_DOT, CHOICE_PILL } from "@/components/employer/app-style";
import { Spinner } from "@/components/ui/Button";
import { busyProps } from "@/components/ui/busy";
import { useLang, useMessages } from "@/i18n/client";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";

/**
 * 续期多久？ — 14, 30 or 60 days, each with the closing date it gives (#69). Lengths that would close the job more
 * than 90 days from now are shown but cannot be picked.
 */
export function RenewQuestion({
  job,
  now,
  submitClassName,
  pending,
  onSubmit,
  onCancel,
}: {
  job: Pick<Job, "status" | "expiresAt">;
  now: number;
  submitClassName: string;
  pending: boolean;
  onSubmit: (days: RenewDays) => void;
  onCancel: () => void;
}) {
  const lang = useLang();
  const t = useMessages(employerJobsMessages).renew;
  const state = renewState(job, now, lang);
  const choices = state.allowed ? state.choices : [];
  const firstAllowed =
    choices.find((c) => c.days === DEFAULT_RENEW_DAYS && c.allowed) ?? choices.find((c) => c.allowed);
  const [days, setDays] = useState<RenewDays | undefined>(firstAllowed?.days);
  const name = useId();

  return (
    <fieldset className="mt-3 w-full space-y-3 border-t border-border pt-4">
      <legend className="float-left mb-3 w-full text-body font-medium">{t.question}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {choices.map((choice) => (
          <label key={choice.days} className={CHOICE_PILL}>
            <input
              type="radio"
              name={name}
              value={choice.days}
              checked={days === choice.days}
              disabled={!choice.allowed}
              onChange={() => setDays(choice.days)}
              autoFocus={choice.days === firstAllowed?.days}
              className={CHOICE_DOT}
            />
            {t.days(choice.days)}
            <span className="text-meta font-normal text-muted">{t.closesOn(closeDateZh(choice.expiresAt, lang))}</span>
          </label>
        ))}
      </div>
      <p className="text-meta text-muted">{t.note(LATEST_CLOSE_DAYS)}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={days === undefined}
          onClick={() => days && onSubmit(days)}
          className={submitClassName}
          {...busyProps(pending)}
        >
          {pending && <Spinner />}
          {t.submit}
        </button>
        <button type="button" onClick={onCancel} className="pressable min-h-11 px-3 text-body text-muted underline">
          {t.cancel}
        </button>
      </div>
    </fieldset>
  );
}
