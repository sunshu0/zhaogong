"use client";

import { useState } from "react";
import { answerMyInterview } from "@/app/me/interview-actions";
import { downloadInterviewIcs } from "@/components/seeker/interview-client";
import {
  formatSlot,
  INTERVIEW_MODES,
  REPLY_MAX,
  seekerInterviewStatus,
  type InterviewView,
} from "@/components/seeker/interviews";
import { Button } from "@/components/ui/Button";

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
  const [mode, setMode] = useState<Mode>("choose");
  const [slot, setSlot] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const open = interview.status === "proposed";

  async function answer(response: { kind: Mode | "confirm"; slot?: string | null; reply?: string }) {
    setPending(true);
    setError("");
    const result = await answerMyInterview(jobId, response).catch(() => ({
      ok: false as const,
      error: "网络有问题，没有发出去，请再试一次。",
    }));
    setPending(false);
    if (!result.ok) return setError(result.error);
    onChange(result.interview);
    setMode("choose");
    setReply("");
  }

  return (
    <section aria-label="面试邀约" className="mt-3 rounded-md border border-brand/30 bg-brand-soft/40 p-3">
      <p className="text-body font-medium">{seekerInterviewStatus(interview)}</p>
      <p className="text-meta text-muted">
        {[interview.mode && INTERVIEW_MODES[interview.mode], interview.place].filter(Boolean).join(" · ")}
      </p>
      {interview.note && <p className="mt-1 text-body">雇主附言：{interview.note}</p>}

      {open && mode === "choose" && (
        <div className="mt-2 space-y-2">
          {!interview.callFirst && (
            <fieldset>
              <legend className="mb-1 text-meta text-muted">选一个你能来的时间（奥克兰时间）</legend>
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
                    {formatSlot(s)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex flex-wrap gap-2">
            {interview.callFirst ? (
              <Button onClick={() => void answer({ kind: "confirm", slot: null })} disabled={pending}>
                好的，等电话约时间
              </Button>
            ) : (
              <Button onClick={() => void answer({ kind: "confirm", slot })} disabled={pending || !slot}>
                确认这个时间
              </Button>
            )}
            <Button variant="secondary" onClick={() => setMode("counter")}>
              {interview.callFirst ? "说说我方便的时间" : "这些时间不行"}
            </Button>
            <Button variant="link" onClick={() => setMode("decline")}>
              婉拒
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
            <span className="mb-1 block font-medium">{mode === "counter" ? "我方便的时间" : "原因（选填）"}</span>
            <textarea
              rows={2}
              value={reply}
              maxLength={REPLY_MAX}
              onChange={(event) => setReply(event.target.value)}
              placeholder={mode === "counter" ? "例如：周四下午、周末都可以" : ""}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-body focus:border-brand"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending || (mode === "counter" && !reply.trim())}>
              {mode === "counter" ? "发给雇主" : "确认婉拒"}
            </Button>
            <Button variant="link" onClick={() => setMode("choose")}>
              返回
            </Button>
          </div>
        </form>
      )}

      {interview.status === "confirmed" && interview.chosenSlot && (
        <Button
          variant="link"
          className="mt-1 -ml-1"
          onClick={() => downloadInterviewIcs(interview, `${jobId}-${interview.invitedAt}`, `面试：${title}`)}
        >
          下载日历文件（.ics）
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
