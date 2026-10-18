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
    if (!next) return setError("没有取消成功，请再试一次。");
    onChange(next);
    refocus.current = true;
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      {interview && (
        <div role="status" aria-label={`和${name}的面试`} className="mb-2 text-body">
          <p className="font-medium">{employerInterviewStatus(interview)}</p>
          {live && interview.status !== "confirmed" && (
            <p className="text-meta text-muted">给的时间：{whenText(interview)}</p>
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
              error: "网络有问题，没有发出去，请再试一次。",
            }));
            setPending(false);
            if (!result.ok) return setError(result.error);
            onChange(result.interview);
            setOpenAt(null);
            refocus.current = true;
            toast("邀约已发出");
          }}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            id={openButton}
            variant="secondary"
            onClick={() => setOpenAt(instantToAuckland(new Date().toISOString()))}
          >
            {live ? "改时间" : "约面试"}
          </Button>
          {live && (
            <Button variant="link" onClick={() => void cancel()} {...busyProps(pending)}>
              取消面试
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
  const [callFirst, setCallFirst] = useState(initial?.callFirst ?? false);
  const [times, setTimes] = useState<string[]>(initial?.slots.length ? initial.slots.map(instantToAuckland) : [""]);
  const [mode, setMode] = useState<InterviewMode | "">(initial?.mode ?? "");
  const [place, setPlace] = useState(initial?.place ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [problem, setProblem] = useState("");

  function send() {
    const filled = callFirst ? [] : times.filter(Boolean);
    const slots = filled.map(aucklandToInstant);
    if (slots.some((slot) => !slot)) return setProblem("有一个时间不完整，请把日期和时刻都选上");
    setProblem("");
    onSend({ slots: slots as string[], callFirst, mode: mode || null, place, note });
  }

  return (
    <form
      aria-label={`约${name}面试`}
      className="space-y-3 rounded-card bg-background p-4"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <fieldset>
        <legend className="mb-1 text-body font-medium">面试时间</legend>
        <div className="flex flex-wrap gap-x-5 px-2">
          <Radio checked={!callFirst} onChange={() => setCallFirst(false)}>
            给具体时间
          </Radio>
          <Radio checked={callFirst} onChange={() => setCallFirst(true)}>
            电话联系后再定
          </Radio>
        </div>
        {!callFirst && (
          <div className="mt-1 space-y-2">
            <p className="text-meta text-muted">
              奥克兰时间。想给几个就给几个，对方从里面选一个，或回一句自己方便的时间。
            </p>
            {times.map((time, i) => (
              <div key={i} className="flex items-center gap-2">
                <label className="min-w-0 flex-1 text-body">
                  <span className="sr-only">时间 {i + 1}</span>
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
                    aria-label={`删除时间 ${i + 1}`}
                    onClick={() => setTimes(times.filter((_, j) => j !== i))}
                    className="pressable min-h-11 px-2 text-meta text-muted hover:text-danger"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
            {times.length < SLOT_MAX && (
              <Button variant="link" onClick={() => setTimes([...times, ""])}>
                再加一个时间
              </Button>
            )}
          </div>
        )}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          name="interview-mode"
          label="面试方式（选填）"
          placeholder="不填"
          options={(Object.entries(INTERVIEW_MODES) as [InterviewMode, string][]).map(([value, label]) => ({
            value,
            label,
          }))}
          defaultValue={mode}
          onChange={(value) => setMode(value as InterviewMode | "")}
        />
        <label className="block text-body">
          <span className="mb-1 block text-meta text-muted">地点或说明（选填）</span>
          <input
            value={place}
            maxLength={PLACE_MAX}
            onChange={(event) => setPlace(event.target.value)}
            placeholder="例如：到店找经理"
            className={`${inputClass} h-11`}
          />
        </label>
      </div>
      <label className="block text-body">
        <span className="mb-1 block text-meta text-muted">附言（选填）</span>
        <textarea
          rows={2}
          value={note}
          maxLength={INTERVIEW_NOTE_MAX}
          onChange={(event) => setNote(event.target.value)}
          className={`${inputClass} py-2`}
        />
      </label>
      <p className="text-meta text-muted">邀约里不带你的联系方式；要交换，在聊天里发起。</p>
      {problem && (
        <p role="alert" className="text-meta text-danger">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          {initial ? "发出新的邀约" : "发出邀约"}
        </Button>
        <Button variant="link" onClick={onCancel}>
          收起
        </Button>
      </div>
    </form>
  );
}
