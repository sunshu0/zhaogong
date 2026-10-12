"use client";
import { useId, useState } from "react";
import { PRODUCT_NAME } from "@/i18n/labels";
import { MAX_HIRES, type HiresAnswer } from "@/components/employer/hires";

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
  const [choice, setChoice] = useState<"hired" | "none" | undefined>(initial == null ? undefined : initial > 0 ? "hired" : "none");
  const [count, setCount] = useState(initial && initial > 0 ? initial : 1);
  const name = useId();
  const answer: HiresAnswer | undefined = choice === "hired" ? { hired: true, count } : choice === "none" ? { hired: false } : undefined;
  const chip =
    "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm has-checked:border-brand has-checked:bg-brand-soft has-checked:text-brand";

  return (
    <fieldset className="mt-3 w-full space-y-2 rounded-lg border border-border bg-background p-3">
      <legend className="px-1 text-sm font-medium">
        通过{PRODUCT_NAME}招到人了吗？{optional && <span className="font-normal text-muted">（可不填）</span>}
      </legend>
      <div className="flex flex-wrap items-center gap-2">
        <label className={chip}>
          <input type="radio" name={name} checked={choice === "hired"} onChange={() => setChoice("hired")} autoFocus className="accent-brand" />
          招到了
        </label>
        <label className="inline-flex items-center gap-1 text-sm">
          <select
            aria-label="招到的人数"
            value={count}
            disabled={choice !== "hired"}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-9 rounded-lg border border-border bg-surface px-2 disabled:opacity-40"
          >
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          人
        </label>
        <label className={chip}>
          <input type="radio" name={name} checked={choice === "none"} onChange={() => setChoice("none")} className="accent-brand" />
          没有 / 不确定
        </label>
      </div>
      <p className="text-xs text-muted">只用来统计{PRODUCT_NAME}一共帮多少人找到了工作。</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending || (!optional && !answer)} onClick={() => onSubmit(answer)} className={submitClassName}>
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="h-9 px-2 text-sm text-muted underline">
          取消
        </button>
      </div>
    </fieldset>
  );
}
