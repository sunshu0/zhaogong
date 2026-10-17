import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { CHOICE_DOT, CHOICE_PILL } from "@/components/employer/app-style";

const BOX =
  "peer size-5 shrink-0 cursor-pointer appearance-none rounded-[6px] border-2 border-muted/60 bg-surface transition-colors duration-(--duration-press) checked:border-brand checked:bg-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed";

/**
 * A choice as a pill (Round 19): the browser's radio or checkbox, drawn like ui Radio / Checkbox, inside a rounded
 * label that fills in the brand's soft colour when chosen. For rows of short choices (工作类型, 签证, 岗位类别).
 */
export function ChoicePill({
  type,
  name,
  checked,
  disabled,
  onChange,
  children,
}: {
  type: "radio" | "checkbox";
  name?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  const input = { name, checked, disabled, onChange };
  return (
    <label className={CHOICE_PILL}>
      {type === "radio" ? (
        <input type="radio" {...input} className={CHOICE_DOT} />
      ) : (
        <span className="relative grid shrink-0 place-content-center">
          <input type="checkbox" {...input} className={BOX} />
          <Check
            aria-hidden="true"
            strokeWidth={3.5}
            className="pointer-events-none absolute inset-0 m-auto size-3.5 scale-0 text-white transition-transform duration-(--duration-press) peer-checked:scale-100"
          />
        </span>
      )}
      {children}
    </label>
  );
}
