"use client";

import { useRef, useState } from "react";
import { answerMyInterview } from "@/app/[lang]/me/interview-actions";
import { downloadInterviewIcs } from "@/components/seeker/interview-client";
import {
  formatSlot,
  interviewModeName,
  REPLY_MAX,
  seekerInterviewStatus,
  type InterviewView,
} from "@/components/seeker/interviews";
import { Button } from "@/components/ui/Button";
import { useLang, useMessages } from "@/i18n/client";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { contentLang } from "@/i18n/lang";

type Mode = "choose" | "counter" | "decline";

/**
 * The employer's interview invitation on one of 我的申请 (#103): what they offered, and the answer — one of their
 * times, 婉拒, or 这些时间不行 with the times that suit in the job seeker's own words. A confirmed time can be saved
 * as a calendar file.
 */
export function InterviewAnswer({
  jobId,
  title,
  interview,
  onChange,
}: {
  jobId: string;
  title: string;
  interview: InterviewView;
  onChange: (interview: InterviewView) => void;
}) {
  const lang = useLang();
  const t = useMessages(seekerMeMessages).interview;
  const [mode, setMode] = useState<Mode>("choose");
  const [slot, setSlot] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const status = useRef<HTMLParagraphElement>(null);
  const open = interview.status === "proposed";

  async function answer(response: { kind: Mode | "confirm"; slot?: string | null; reply?: string }) {
    setPending(true);
    setError("");
    const result = await answerMyInterview(jobId, response).catch(() => ({
      ok: false as const,
      error: t.errors.network,
    }));
    setPending(false);
    if (!result.ok) return setError(result.error);
    onChange(result.interview);
    setMode("choose");
    setReply("");
    status.current?.focus(); // the answer's buttons go away: the focus goes to what the invitation says now (#202)
  }

  return (
    <section aria-label={t.answer.label} className="mt-3 rounded-md border border-brand/30 bg-brand-soft/40 p-3">
      <p ref={status} tabIndex={-1} className="text-body font-medium outline-none">
        {seekerInterviewStatus(interview, lang)}
      </p>
      <p className="text-meta text-muted">
        {[interview.mode && interviewModeName(interview.mode, lang), interview.place].filter(Boolean).join(" · ")}
      </p>
      {interview.note && (
        <p className="mt-1 text-body">
          {t.answer.note("")}
          <span lang={contentLang(interview.note)}>{interview.note}</span>
        </p>
      )}

      {open && mode === "choose" && (
        <div className="mt-2 space-y-2">
          {!interview.callFirst && (
            <fieldset>
              <legend className="mb-1 text-meta text-muted">{t.answer.pickSlot}</legend>
              <div className="flex flex-col">
                {interview.slots.map((s) => (
                  <label key={s} className="flex min-h-11 items-center gap-2 text-body">
                    <input
                      type="radio"
                      name={`slot-${jobId}`}
                      checked={slot === s}
                      onChange={() => setSlot(s)}
                      className="accent-brand"
                    />
                    {formatSlot(s, lang)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2">
            {interview.callFirst ? (
              <Button onClick={() => void answer({ kind: "confirm", slot: null })} loading={pending}>
                {t.answer.okByPhone}
              </Button>
            ) : (
              <Button onClick={() => void answer({ kind: "confirm", slot })} disabled={!slot} loading={pending}>
                {t.answer.confirm}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setMode("counter")}>
              {interview.callFirst ? t.answer.suggest : t.answer.notThese}
            </Button>
            <Button variant="link" onClick={() => setMode("decline")}>
              {t.answer.decline}
            </Button>
          </div>
        </div>
      )}

      {open && mode !== "choose" && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            void answer({ kind: mode, reply });
          }}
        >
          <label className="block text-body">
            <span className="mb-1 block font-medium">{mode === "counter" ? t.answer.myTimes : t.answer.reason}</span>
            <textarea
              rows={2}
              value={reply}
              maxLength={REPLY_MAX}
              onChange={(event) => setReply(event.target.value)}
              placeholder={mode === "counter" ? t.answer.timesPlaceholder : ""}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-body focus:border-brand"
            />
          </label>
          {/* #341: the reply's length against its limit, as the reports' and the application's notes show it. */}
          <p className="text-right text-meta text-muted">
            {reply.length} / {REPLY_MAX}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={mode === "counter" && !reply.trim()} loading={pending}>
              {mode === "counter" ? t.answer.send : t.answer.confirmDecline}
            </Button>
            <Button variant="link" onClick={() => setMode("choose")}>
              {t.answer.back}
            </Button>
          </div>
        </form>
      )}

      {interview.status === "confirmed" && interview.chosenSlot && (
        <Button
          variant="link"
          className="mt-1 -ml-1"
          onClick={() =>
            downloadInterviewIcs(
              interview,
              `${jobId}-${interview.invitedAt}`,
              t.answer.calendarTitle(title),
              t.answer.calendarFile,
              lang,
            )
          }
        >
          {t.answer.calendar}
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-meta text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
