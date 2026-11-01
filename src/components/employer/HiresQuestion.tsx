"use client";
import { useId, useState } from "react";
import { PRODUCT_NAME } from "@/i18n/labels";
import { MAX_HIRES, type HiresAnswer } from "@/components/employer/hires";
import { CHOICE_DOT, CHOICE_PILL } from "@/components/employer/app-style";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Button";
import { busyProps } from "@/components/ui/busy";
import { useMessages } from "@/i18n/client";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";

const COUNTS = Array.from({ length: MAX_HIRES }, (_, i) => i + 1);

/**
 * 通过找工招到人了吗？ — 招到了 + how many, or 没有 / 不确定. When closing a job it is optional
 * (submitting with nothing chosen just closes); when correcting it needs an answer.
 */
export function HiresQuestion({
  initial,
  optional,
  submitLabel,
  submitClassName,
  pending,
  onSubmit,
  onCancel,
}: {
  /** The count already recorded, when correcting. */
  initial?: number;
  optional: boolean;
  submitLabel: string;
  submitClassName: string;
  pending: boolean;
  onSubmit: (answer: HiresAnswer | undefined) => void;
  onCancel: () => void;
}) {
  const t = useMessages(employerJobsMessages).hires;
  const [choice, setChoice] = useState<"hired" | "none" | undefined>(
    initial == null ? undefined : initial > 0 ? "hired" : "none",
  );
  const [count, setCount] = useState(initial && initial > 0 ? initial : 1);
  const name = useId();
  const answer: HiresAnswer | undefined =
    choice === "hired" ? { hired: true, count } : choice === "none" ? { hired: false } : undefined;

  return (
    <fieldset className="mt-3 w-full space-y-3 border-t border-border pt-4">
      <legend className="float-left mb-3 w-full text-body font-medium">
        {t.question(PRODUCT_NAME)}
        {optional && <span className="font-normal text-muted">{t.optional}</span>}
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        <label className={CHOICE_PILL}>
          <input
            type="radio"
            name={name}
            checked={choice === "hired"}
            onChange={() => setChoice("hired")}
            autoFocus
            className={CHOICE_DOT}
          />
          {t.hired}
        </label>
        <label className={CHOICE_PILL}>
          <input
            type="radio"
            name={name}
            checked={choice === "none"}
            onChange={() => setChoice("none")}
            className={CHOICE_DOT}
          />
          {t.none}
        </label>
      </div>
      {/* Round 19: how many shows once 招到了 is chosen, in the shared Select (a bottom sheet on phones). */}
      {choice === "hired" && (
        <div className="max-w-48">
          <Select
            name="hires-count"
            label={t.countLabel}
            required
            options={COUNTS.map((n) => ({ value: String(n), label: t.countOption(n) }))}
            defaultValue={String(count)}
            onChange={(value) => setCount(Number(value))}
          />
        </div>
      )}
      <p className="text-meta text-muted">{t.why(PRODUCT_NAME)}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!optional && !answer}
          onClick={() => onSubmit(answer)}
          className={submitClassName}
          {...busyProps(pending)}
        >
          {pending && <Spinner />}
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="pressable min-h-11 px-3 text-body text-muted underline">
          {t.cancel}
        </button>
      </div>
    </fieldset>
  );
}
