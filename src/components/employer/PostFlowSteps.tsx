"use client";
// The pieces of /employer/post, one per step, plus the step list and the mode switch (bars: PostFlowBars.tsx).
import { DuplicateJobNote } from "@/components/employer/DuplicateJobNote";
import type { ReactNode, RefObject } from "react";
import { SAMPLE_POST } from "@/lib/ai-post";
import type { ParseNote } from "@/lib/ai-post/parse";
import type { CountryCode, Employer, Job } from "@/lib/types";
import type { DraftFormState } from "@/components/employer/use-draft-form";
import { DraftEditor } from "@/components/employer/DraftEditor";
import { CLEAR_OF_STICKY_BARS, keepFocusClear } from "@/components/employer/use-draft-form";
import type { Mode, Step } from "@/components/employer/post-flow-state";
import { JobDetail } from "@/components/seeker/JobDetail";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { Button } from "@/components/ui/Button";
import { pillTab } from "@/components/employer/Tabs";
import { useLang, useMessages } from "@/i18n/client";
import { employerPostMessages } from "@/i18n/messages/employer-post";

type HeadingRef = RefObject<HTMLHeadingElement | null>;

const STEPS: Record<Mode, Exclude<Step, "done">[]> = {
  chat: ["chat", "preview"],
  form: ["paste", "form", "preview"],
};

const MODES = ["chat", "form"] as const;

export function StepList({ mode, step }: { mode: Mode; step: Step }) {
  const t = useMessages(employerPostMessages).steps;
  return (
    <ol aria-label={t.listLabel} className="flex gap-4 border-b border-border text-meta">
      {STEPS[mode].map((key, i) => (
        <li
          key={key}
          aria-current={key === step ? "step" : undefined}
          className={`-mb-px flex-1 border-b-2 pb-1.5 text-center ${key === step ? "border-brand font-semibold text-brand" : "border-transparent text-muted"}`}
        >
          {i + 1} {t[key]}
        </li>
      ))}
    </ol>
  );
}

export function ModeSwitch({ mode, onSwitch }: { mode: Mode; onSwitch: (mode: Mode) => void }) {
  const t = useMessages(employerPostMessages).steps;
  const labels = { chat: t.modeChat, form: t.modeForm };
  return (
    <div role="group" aria-label={t.modeLabel} className="flex gap-2">
      {MODES.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={mode === key}
          onClick={() => onSwitch(key)}
          className={pillTab(mode === key)}
        >
          {labels[key]}
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
  const t = useMessages(employerPostMessages).steps;
  return (
    <section onFocus={keepFocusClear} className={`space-y-3 ${CLEAR_OF_STICKY_BARS}`}>
      <h1 ref={headingRef} tabIndex={-1} className="text-title font-semibold outline-none">
        {t.pasteHeading}
      </h1>
      <label htmlFor="post-text" className="block text-body text-muted">
        {t.pasteLabel}
      </label>
      <textarea
        id="post-text"
        // The paste box takes a Chinese WeChat post, and its example is one.
        lang="zh-CN"
        rows={9}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={SAMPLE_POST}
        className="w-full rounded-control border border-border bg-surface p-3 leading-relaxed placeholder:text-muted/60 focus:border-brand"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" loading={pending} disabled={!text.trim()} onClick={onParse} className="flex-1">
          {pending ? t.parsing : t.parse}
        </Button>
        <button
          type="button"
          onClick={() => setText(SAMPLE_POST)}
          className="pressable min-h-11 text-body text-brand underline"
        >
          {t.tryExample}
        </button>
      </div>
      <button type="button" onClick={onEmptyForm} className="pressable min-h-11 text-body text-muted underline">
        {t.emptyForm}
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
  notes: ParseNote[];
}) {
  const t = useMessages(employerPostMessages).steps;
  return (
    <>
      <h1 ref={headingRef} tabIndex={-1} className="text-title font-semibold outline-none">
        {t.formHeading}
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
  const m = useMessages(employerPostMessages);
  const lang = useLang();
  const t = m.steps;
  // The kinds the job makes public, in the page's language (as contactKinds does in Chinese).
  const kinds = [
    preview.contact.phone && m.checklist.contactPhone,
    preview.contact.wechat && m.checklist.contactWechat,
    preview.contact.email && m.checklist.contactEmail,
  ]
    .filter(Boolean)
    .join(m.checklist.separator);
  return (
    <section onFocus={keepFocusClear} className={`space-y-4 ${CLEAR_OF_STICKY_BARS}`}>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="rounded-control bg-brand-soft px-3 py-2 text-body font-normal text-brand outline-none"
      >
        {t.previewHeading}
      </h1>
      {needsReview && (
        <p className="rounded-control bg-warn-soft px-3 py-2 text-body text-warn">{t.previewNeedsReview}</p>
      )}
      <DuplicateJobNote titleZh={preview.titleZh} />
      {roles && <div className="rounded-card bg-surface p-4 ring-1 ring-border">{roles}</div>}
      <JobDetail job={preview} employer={employer} now={previewAt} lang={lang}>
        <section className="rounded-card bg-surface p-4 ring-1 ring-border">
          <h2 className="text-subtitle font-semibold">{t.previewContactTitle}</h2>
          <p className="mt-1 text-body text-muted">
            {preview.contactPublic ? t.previewContactPublic(kinds) : t.previewContactPrivate}
          </p>
        </section>
      </JobDetail>
      {banned && <p className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger">{t.previewBanned}</p>}
    </section>
  );
}
