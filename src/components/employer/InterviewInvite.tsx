"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cancelMyApplicantInterview, inviteMyApplicant } from "@/app/[lang]/employer/interview-actions";
import {
  aucklandToInstant,
  employerInterviewStatus,
  instantToAuckland,
  INTERVIEW_MODES,
  interviewModeName,
  INTERVIEW_NOTE_MAX,
  PLACE_MAX,
  SLOT_MAX,
  whenText,
  type InterviewMode,
  type InterviewView,
} from "@/components/seeker/interviews";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Radio } from "@/components/ui/Checkbox";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/ui/Toast";
import { busyProps } from "@/components/ui/busy";
import { inputClass } from "@/components/ui/input-class";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { useLang, useMessages } from "@/i18n/client";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";

/** From here the form opens in the card; below it (a phone, a narrow window) it opens in a bottom sheet (E5-3). */
const DESKTOP = "(min-width: 1024px)";

/**
 * 约面试 on an applicant (#103): the business's invitation as it stands, and the form to send or change it. Any
 * times, as many as the employer likes, or none (电话联系后再定); a time already past is refused with a reason.
 * E5-2: `lead` (the card's 打开聊天) shares the row of 约面试, so a card is a row shorter on a phone.
 * E5-3: below 1024 px the form opens in a bottom sheet, 发出邀约 fixed at its foot, and the card's row stays as it is;
 * closing the sheet (收起, Esc, a tap outside) sends nothing and puts the focus back on 约面试.
 */
export function InterviewInvite({
  applicationId,
  name,
  interview,
  onChange,
  lead,
}: {
  applicationId: string;
  name: string;
  interview: InterviewView | null;
  onChange: (interview: InterviewView) => void;
  /** First in the row of 约面试; above the form while it is open in the card. */
  lead?: ReactNode;
}) {
  const t = useMessages(employerApplicantsMessages).interviewInvite;
  const lang = useLang();
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
  // Before JavaScript runs nothing is open, so the server can assume the card.
  const inCard = useMediaQuery(DESKTOP, true);
  const formId = useId();

  function close() {
    setOpenAt(null);
    // #304: a failure belongs to the form that was put away.
    setError("");
    refocus.current = true;
  }

  async function send(invite: Invite) {
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
  }

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
    <div className="mt-3">
      {interview && (
        <div role="status" aria-label={t.statusLabel(name)} className="mb-2 text-body">
          <p className="font-medium">{employerInterviewStatus(interview, lang)}</p>
          {live && interview.status !== "confirmed" && (
            <p className="text-meta text-muted">{t.timesGiven(whenText(interview, lang))}</p>
          )}
        </div>
      )}
      {openAt && inCard && lead && <div className="mb-3 flex flex-wrap gap-2">{lead}</div>}
      {openAt && inCard ? (
        <InviteForm
          min={openAt}
          initial={live ? interview : null}
          name={name}
          pending={pending}
          onCancel={close}
          onSend={(invite) => void send(invite)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {lead}
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
      {!inCard && (
        <BottomSheet
          open={!!openAt}
          onClose={close}
          title={t.formLabel(name)}
          footer={
            // Below the scrolling form, so 发出邀约 is always in reach, with the keyboard up too; what went wrong is
            // just above it, where the eye is after pressing it (E5-3 返工 1).
            <div className="space-y-2">
              {error && (
                <p role="alert" className="px-2 text-meta text-danger">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={close}>
                  {t.collapse}
                </Button>
                <Button type="submit" form={formId} size="lg" loading={pending} className="flex-[2]">
                  {live ? t.sendAgain : t.send}
                </Button>
              </div>
            </div>
          }
        >
          {openAt && (
            <div className="px-2">
              <InviteForm
                id={formId}
                min={openAt}
                initial={live ? interview : null}
                name={name}
                pending={pending}
                onCancel={close}
                onProblem={setError}
                onSend={(invite) => void send(invite)}
              />
            </div>
          )}
        </BottomSheet>
      )}
      {error && !(openAt && !inCard) && (
        <p role="alert" className="mt-2 text-meta text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type Invite = { slots: string[]; callFirst: boolean; mode: InterviewMode | null; place: string; note: string };

/**
 * The form. With an `id` it is in the bottom sheet, whose footer holds its buttons (`form={id}`) and, through
 * `onProblem`, what is wrong with it; else it has its own.
 */
function InviteForm({
  id,
  min,
  initial,
  name,
  pending,
  onCancel,
  onProblem,
  onSend,
}: {
  id?: string;
  min: string;
  initial: InterviewView | null;
  name: string;
  pending: boolean;
  onCancel: () => void;
  onProblem?: (problem: string) => void;
  onSend: (invite: Invite) => void;
}) {
  const t = useMessages(employerApplicantsMessages).interviewInvite;
  const lang = useLang();
  const [callFirst, setCallFirst] = useState(initial?.callFirst ?? false);
  const [times, setTimes] = useState<string[]>(initial?.slots.length ? initial.slots.map(instantToAuckland) : [""]);
  const [mode, setMode] = useState<InterviewMode | "">(initial?.mode ?? "");
  const [place, setPlace] = useState(initial?.place ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [shown, setShown] = useState("");
  const problem = onProblem ? "" : shown;
  const setProblem = onProblem ?? setShown;
  // #304: the two ways to give the time are one group: arrow keys move between them, one Tab stop, "1 of 2".
  const timeChoice = useId();
  // #248: the form takes the place of 邀请面试 / 改时间, and with it the focus: its chosen time option, else the first.
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const box = form.current;
    const first = box?.querySelector<HTMLElement>("input:checked") ?? box?.querySelector<HTMLElement>("input");
    // In the bottom sheet, the sheet opens after this runs and gives the focus to what is marked (E5-3).
    first?.setAttribute("data-autofocus", "");
    first?.focus();
  }, []);

  function send() {
    const filled = callFirst ? [] : times.filter(Boolean);
    const slots = filled.map(aucklandToInstant);
    if (slots.some((slot) => !slot)) return setProblem(t.incompleteTime);
    setProblem("");
    onSend({ slots: slots as string[], callFirst, mode: mode || null, place, note });
  }

  return (
    <form
      ref={form}
      id={id}
      aria-label={t.formLabel(name)}
      className={`space-y-3 rounded-card ${id ? "px-2 pt-1" : "bg-background p-4"}`}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <fieldset>
        <legend className="mb-1 text-body font-medium">{t.timeLegend}</legend>
        <div className="flex flex-wrap gap-x-5 px-2">
          <Radio name={timeChoice} checked={!callFirst} onChange={() => setCallFirst(false)}>
            {t.giveTimes}
          </Radio>
          <Radio name={timeChoice} checked={callFirst} onChange={() => setCallFirst(true)}>
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
                    className={inputClass()}
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
          options={(Object.keys(INTERVIEW_MODES) as InterviewMode[]).map((value) => ({
            value,
            label: interviewModeName(value, lang),
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
            className={inputClass()}
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
          className={inputClass({ multiline: true })}
        />
      </label>
      <p className="text-meta text-muted">{t.noContactNote}</p>
      {problem && (
        <p role="alert" className="text-meta text-danger">
          {problem}
        </p>
      )}
      {!id && (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            {initial ? t.sendAgain : t.send}
          </Button>
          <Button variant="link" onClick={onCancel}>
            {t.collapse}
          </Button>
        </div>
      )}
    </form>
  );
}
