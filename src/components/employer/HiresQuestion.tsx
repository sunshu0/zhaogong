"use client";
import { useId, useState } from "react";
import { PRODUCT_NAME } from "@/i18n/labels";
import { MAX_HIRES, type HiresAnswer } from "@/components/employer/hires";
import { CHOICE_DOT, CHOICE_PILL } from "@/components/employer/app-style";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Button";

const COUNTS = Array.from({ length: MAX_HIRES }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 人` }));

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
  const [choice, setChoice] = useState<"hired" | "none" | undefined>(
    initial == null ? undefined : initial > 0 ? "hired" : "none",
  );
  const [count, setCount] = useState(initial && initial > 0 ? initial : 1);
  const name = useId();
  const answer: HiresAnswer | undefined =
    choice === "hired" ? { hired: true, count } : choice === "none" ? { hired: false } : undefined;

  return (
    <fieldset className="mt-3 w-full space-y-3 rounded-card bg-background p-4">
      <legend className="float-left mb-3 w-full text-body font-medium">
        通过{PRODUCT_NAME}招到人了吗？{optional && <span className="font-normal text-muted">（可不填）</span>}
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
          招到了
        </label>
        <label className={CHOICE_PILL}>
          <input
            type="radio"
            name={name}
            checked={choice === "none"}
            onChange={() => setChoice("none")}
            className={CHOICE_DOT}
          />
          没有 / 不确定
        </label>
      </div>
      {/* Round 19: how many shows once 招到了 is chosen, in the shared Select (a bottom sheet on phones). */}
      {choice === "hired" && (
        <div className="max-w-48">
          <Select
            name="hires-count"
            label="招到的人数"
            required
            options={COUNTS}
            defaultValue={String(count)}
            onChange={(value) => setCount(Number(value))}
          />
        </div>
      )}
      <p className="text-meta text-muted">只用来统计{PRODUCT_NAME}一共帮多少人找到了工作。</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || (!optional && !answer)}
          aria-busy={pending || undefined}
          onClick={() => onSubmit(answer)}
          className={submitClassName}
        >
          {pending && <Spinner />}
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="pressable min-h-11 px-3 text-body text-muted underline">
          取消
        </button>
      </div>
    </fieldset>
  );
}
