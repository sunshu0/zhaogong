"use client";
// The pieces of /employer/post, one per step, plus the step list and the mode switch (bars: PostFlowBars.tsx).
import type { ReactNode, RefObject } from "react";
import { SAMPLE_POST } from "@/lib/ai-post";
import type { CountryCode, Employer, Job } from "@/lib/types";
import type { DraftFormState } from "@/components/employer/use-draft-form";
import { DraftEditor } from "@/components/employer/DraftEditor";
import { CLEAR_OF_STICKY_BARS, keepFocusClear } from "@/components/employer/use-draft-form";
import type { Mode, Step } from "@/components/employer/post-flow-state";
import { JobDetail } from "@/components/seeker/JobDetail";
import { contactKinds } from "@/components/seeker/job-facts";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { buttonClass } from "@/components/ui/Button";

type HeadingRef = RefObject<HTMLHeadingElement | null>;

const STEPS: Record<Mode, { key: Exclude<Step, "done">; label: string }[]> = {
  chat: [
    { key: "chat", label: "和助手对话" },
    { key: "preview", label: "预览发布" },
  ],
  form: [
    { key: "paste", label: "粘贴" },
    { key: "form", label: "核对" },
    { key: "preview", label: "预览发布" },
  ],
};

const MODES = [
  ["chat", "对话发布"],
  ["form", "直接填表"],
] as const;

export function StepList({ mode, step }: { mode: Mode; step: Step }) {
  return (
    <ol aria-label="发布步骤" className="flex gap-4 border-b border-border text-meta">
      {STEPS[mode].map((s, i) => (
        <li
          key={s.key}
          aria-current={s.key === step ? "step" : undefined}
          className={`-mb-px flex-1 border-b-2 pb-1.5 text-center ${s.key === step ? "border-brand font-semibold text-brand" : "border-transparent text-muted"}`}
        >
          {i + 1} {s.label}
        </li>
      ))}
    </ol>
  );
}

export function ModeSwitch({ mode, onSwitch }: { mode: Mode; onSwitch: (mode: Mode) => void }) {
  return (
    <div role="group" aria-label="发布方式" className="flex gap-2">
      {MODES.map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-pressed={mode === key}
          onClick={() => onSwitch(key)}
          className={`h-9 rounded-md border px-4 text-body ${mode === key ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border bg-surface text-muted"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function PasteStep({
  headingRef,
  text,
  setText,
  pending,
  onParse,
  onEmptyForm,
}: {
  headingRef: HeadingRef;
  text: string;
  setText: (text: string) => void;
  pending: boolean;
  onParse: () => void;
  onEmptyForm: () => void;
}) {
  return (
    <section onFocus={keepFocusClear} className={`space-y-3 ${CLEAR_OF_STICKY_BARS}`}>
      <h1 ref={headingRef} tabIndex={-1} className="text-title font-semibold outline-none">
        一分钟发布招聘
      </h1>
      <label htmlFor="post-text" className="block text-body text-muted">
        把微信群里的招聘消息粘贴进来，或者直接写：招什么人、在哪个区、时薪多少。
      </label>
      <textarea
        id="post-text"
        rows={9}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={SAMPLE_POST}
        className="w-full rounded-md border border-border bg-surface p-3 leading-relaxed placeholder:text-muted/60"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!text.trim() || pending}
          onClick={onParse}
          className={`${buttonClass("primary")} flex-1`}
        >
          {pending ? "整理中…" : "整理成职位"}
        </button>
        <button type="button" onClick={() => setText(SAMPLE_POST)} className="text-body text-brand underline">
          用示例试试
        </button>
      </div>
      <button type="button" onClick={onEmptyForm} className="text-body text-muted underline">
        不用粘贴，直接填表
      </button>
    </section>
  );
}

export function FormStep({
  headingRef,
  form,
  country,
  notes,
}: {
  headingRef: HeadingRef;
  form: DraftFormState;
  country: CountryCode;
  notes: string[];
}) {
  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="text-title font-semibold outline-none">
        核对职位信息
      </h1>
      <div onFocus={keepFocusClear} className={`${WIDE_ON_DESKTOP} ${CLEAR_OF_STICKY_BARS}`}>
        <DraftEditor state={form} country={country} notes={notes} />
      </div>
    </>
  );
}

export function PreviewStep({
  headingRef,
  preview,
  employer,
  previewAt,
  needsReview,
  banned,
  roles,
}: {
  headingRef: HeadingRef;
  preview: Job;
  employer?: Employer;
  previewAt: number;
  needsReview: boolean;
  banned: boolean;
  /** 岗位类别 to confirm, for a job that came from the chat. */
  roles?: ReactNode;
}) {
  return (
    <section onFocus={keepFocusClear} className={`space-y-4 ${CLEAR_OF_STICKY_BARS}`}>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="rounded-md bg-brand-soft px-3 py-2 text-body font-normal text-brand outline-none"
      >
        预览：这是求职者看到的样子。确认无误就可以发布了。
      </h1>
      {needsReview && (
        <p className="rounded-md bg-warn-soft px-3 py-2 text-body text-warn">
          这个职位会先经过人工审核，通过后才公开。
        </p>
      )}
      {roles && <div className="rounded-md border border-border bg-surface p-4">{roles}</div>}
      <JobDetail job={preview} employer={employer} now={previewAt}>
        <section className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-subtitle font-semibold">联系方式</h2>
          <p className="mt-1 text-body text-muted">
            {preview.contactPublic
              ? `登录后可以查看雇主的${contactKinds(preview).join("、")}。`
              : "雇主没有公开联系方式。求职者可以在聊天中申请交换，双方同意后才交换。"}
          </p>
        </section>
      </JobDetail>
      {banned && (
        <p className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
          这个雇主账号已被停用，职位已全部下架，不能再发布。
        </p>
      )}
    </section>
  );
}
