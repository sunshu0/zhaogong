"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cancelMyApplicantInterview, inviteMyApplicant } from "@/app/[lang]/employer/interview-actions";
import {
  aucklandToInstant,
  employerInterviewStatus,
  instantToAuckland,
  INTERVIEW_MODES,
  INTERVIEW_NOTE_MAX,
  PLACE_MAX,
  SLOT_MAX,
  whenText,
  type InterviewMode,
  type InterviewView,
} from "@/components/seeker/interviews";
import { Button } from "@/components/ui/Button";
import { Radio } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { busyProps } from "@/components/ui/busy";
import { useMessages } from "@/i18n/client";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";

const inputClass = "w-full rounded-control border border-border bg-background px-3 text-body focus:border-brand";

/**
 * 约面试 on an applicant (#103): the business's invitation as it stands, and the form to send or change it. Any
 * times, as many as the employer likes, or none (电话联系后再定); a time already past is refused with a reason.
 */
export function InterviewInvite({
  applicationId,
  name,
  interview,
  onChange,
}: {
  applicationId: string;
  name: string;
  interview: InterviewView | null;
  onChange: (interview: InterviewView) => void;
}) {
  const t = useMessages(employerApplicantsMessages).interviewInvite;
  // The earliest a time may be, worked out when the form opens (Auckland wall clock, for datetime-local).
  const [openAt, setOpenAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // #202: after 取消面试, a sent invitation or a closed form, the focus goes back to the button that opens the form.
  const openButton = useId();
  // Set by the handlers; the render that shows the button again moves the focus to it.
  const refocus = useRef(false);
  useEffect(() => {
    if (!refocus.current || openAt) return;
    refocus.current = false;
    document.getElementById(openButton)?.focus();
  });
  // An invitation still in play can be changed or called off; after 婉拒 or 取消 the employer may invite again.
  const live = interview && ["proposed", "confirmed", "counter"].includes(interview.status);

  async function cancel() {
    setPending(true);
    setError("");
    const next = await cancelMyApplicantInterview(applicationId).catch(() => null);
    setPending(false);
    if (!next) return setError(t.cancelFailed);
    onChange(next);
    refocus.current = true;
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      {interview && (
        <div role="status" aria-label={t.statusLabel(name)} className="mb-2 text-body">
          <p className="font-medium">{employerInterviewStatus(interview)}</p>
          {live && interview.status !== "confirmed" && (
            <p className="text-meta text-muted">{t.timesGiven(whenText(interview))}</p>
          )}
        </div>
      )}
      {openAt ? (
        <InviteForm
          min={openAt}
          initial={live ? interview : null}
          name={name}
          pending={pending}
          onCancel={() => {
            setOpenAt(null);
            refocus.current = true;
          }}
          onSend={async (invite) => {
            setPending(true);
            setError("");
            const result = await inviteMyApplicant(applicationId, invite).catch(() => ({
              ok: false as const,
              error: t.sendFailed,
            }));
            setPending(false);
            if (!result.ok) return setError(result.error);
            onChange(result.interview);
            setOpenAt(null);
            refocus.current = true;
            toast(t.sent);
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            id={openButton}
            variant="secondary"
            onClick={() => setOpenAt(instantToAuckland(new Date().toISOString()))}
          >
            {live ? t.changeTimes : t.invite}
          </Button>
          {live && (
            <Button variant="link" onClick={() => void cancel()} {...busyProps(pending)}>
              {t.cancelInterview}
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function InviteForm({
  min,
  initial,
  name,
  pending,
  onCancel,
  onSend,
}: {
  min: string;
  initial: InterviewView | null;
  name: string;
  pending: boolean;
  onCancel: () => void;
  onSend: (invite: {
    slots: string[];
    callFirst: boolean;
    mode: InterviewMode | null;
    place: string;
    note: string;
  }) => void;
}) {
  const t = useMessages(employerApplicantsMessages).interviewInvite;
  const [callFirst, setCallFirst] = useState(initial?.callFirst ?? false);
  const [times, setTimes] = useState<string[]>(initial?.slots.length ? initial.slots.map(instantToAuckland) : [""]);
  const [mode, setMode] = useState<InterviewMode | "">(initial?.mode ?? "");
  const [place, setPlace] = useState(initial?.place ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [problem, setProblem] = useState("");

  function send() {
    const filled = callFirst ? [] : times.filter(Boolean);
    const slots = filled.map(aucklandToInstant);
    if (slots.some((slot) => !slot)) return setProblem(t.incompleteTime);
    setProblem("");
    onSend({ slots: slots as string[], callFirst, mode: mode || null, place, note });
  }

  return (
    <form
      aria-label={t.formLabel(name)}
      className="space-y-3 rounded-card bg-background p-4"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <fieldset>
        <legend className="mb-1 text-body font-medium">{t.timeLegend}</legend>
        <div className="flex flex-wrap gap-x-5 px-2">
          <Radio checked={!callFirst} onChange={() => setCallFirst(false)}>
            {t.giveTimes}
          </Radio>
          <Radio checked={callFirst} onChange={() => setCallFirst(true)}>
            {t.callFirst}
          </Radio>
        </div>
        {!callFirst && (
          <div className="mt-1 space-y-2">
            <p className="text-meta text-muted">{t.timesHint}</p>
            {times.map((time, i) => (
              <div key={i} className="flex items-center gap-2">
                <label className="min-w-0 flex-1 text-body">
                  <span className="sr-only">{t.timeLabel(i + 1)}</span>
                  <input
                    type="datetime-local"
                    min={min}
                    value={time}
                    onChange={(event) => setTimes(times.map((t, j) => (j === i ? event.target.value : t)))}
                    className={`${inputClass} h-11`}
                  />
                </label>
                {times.length > 1 && (
                  <button
                    type="button"
                    aria-label={t.removeTimeLabel(i + 1)}
                    onClick={() => setTimes(times.filter((_, j) => j !== i))}
                    className="pressable min-h-11 px-2 text-meta text-muted hover:text-danger"
                  >
                    {t.removeTime}
                  </button>
                )}
              </div>
            ))}
            {times.length < SLOT_MAX && (
              <Button variant="link" onClick={() => setTimes([...times, ""])}>
                {t.addTime}
              </Button>
            )}
          </div>
        )}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          name="interview-mode"
          label={t.modeLabel}
          placeholder={t.modePlaceholder}
          options={(Object.entries(INTERVIEW_MODES) as [InterviewMode, string][]).map(([value, label]) => ({
            value,
            label,
          }))}
          defaultValue={mode}
          onChange={(value) => setMode(value as InterviewMode | "")}
        />
        <label className="block text-body">
          <span className="mb-1 block text-meta text-muted">{t.placeLabel}</span>
          <input
            value={place}
            maxLength={PLACE_MAX}
            onChange={(event) => setPlace(event.target.value)}
            placeholder={t.placePlaceholder}
            className={`${inputClass} h-11`}
          />
        </label>
      </div>
      <label className="block text-body">
        <span className="mb-1 block text-meta text-muted">{t.noteLabel}</span>
        <textarea
          rows={2}
          value={note}
          maxLength={INTERVIEW_NOTE_MAX}
          onChange={(event) => setNote(event.target.value)}
          className={`${inputClass} py-2`}
        />
      </label>
      <p className="text-meta text-muted">{t.noContactNote}</p>
      {problem && (
        <p role="alert" className="text-meta text-danger">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          {initial ? t.sendAgain : t.send}
        </Button>
        <Button variant="link" onClick={onCancel}>
          {t.collapse}
        </Button>
      </div>
    </form>
  );
}
