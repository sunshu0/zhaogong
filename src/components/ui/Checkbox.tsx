import { Check } from "lucide-react";
import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * Checkbox and Radio (Round 19): the browser's own inputs, so keyboards, screen readers, forms and tests treat them as
 * before, drawn in the app's style instead of the system's. The whole row is the label and at least 44px high.
 */
const ROW = "pressable-row -mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-control px-2 text-body";
const BOX =
  "grid size-5 shrink-0 cursor-pointer appearance-none place-content-center border-2 border-muted/60 bg-surface transition-colors duration-(--duration-press) checked:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { children: ReactNode };

export function Checkbox({ children, className = "", ...props }: Props) {
  return (
    <label className={`${ROW} ${className}`.trim()}>
      <span className="relative grid shrink-0 place-content-center">
        <input type="checkbox" className={`peer ${BOX} rounded-[6px] checked:bg-brand`} {...props} />
        <Check
          aria-hidden="true"
          strokeWidth={3.5}
          className="pointer-events-none absolute inset-0 m-auto size-3.5 scale-0 text-white transition-transform duration-(--duration-press) peer-checked:scale-100"
        />
      </span>
      <span>{children}</span>
    </label>
  );
}

export function Radio({ children, className = "", ...props }: Props) {
  return (
    <label className={`${ROW} ${className}`.trim()}>
      <span className="relative grid shrink-0 place-content-center">
        <input type="radio" className={`peer ${BOX} rounded-full`} {...props} />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 m-auto size-2.5 scale-0 rounded-full bg-brand transition-transform duration-(--duration-press) peer-checked:scale-100"
        />
      </span>
      <span>{children}</span>
    </label>
  );
}
