import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { busyProps } from "@/components/ui/busy";

/**
 * Three levels of action (Round 11): `primary` is solid brand, at most one per screen; `secondary` is outlined;
 * `link` is a text link. Anything else goes into a MoreMenu. No shadow (Round 13).
 * Round 19: every button answers a press (`pressable`), and a Button can show that its action is on its way
 * (`loading`). `size="lg"` is the 48px main action of a screen, such as a bottom bar's. Controls' 12px corners
 * (rounded-control); `pill` for a fully round one. An action that destroys or blocks something (永久删除, 封禁, 驳回,
 * 下架) is `danger` (solid red) where it is the one to confirm, `danger-secondary` (red outline) where it only
 * leads there.
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "danger-secondary" | "link";
export type ButtonSize = "md" | "lg";

const BASE =
  "pressable inline-flex items-center justify-center gap-2 text-body font-medium disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-busy:cursor-progress";
const SIZES: Record<ButtonSize, string> = { md: "min-h-11", lg: "min-h-12 text-subtitle" };
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand px-4 text-white hover:bg-brand-strong active:bg-brand-strong",
  secondary: "border border-brand/40 bg-surface px-4 text-brand hover:border-brand hover:bg-brand-soft",
  danger: "bg-danger px-4 text-white hover:opacity-90",
  "danger-secondary": "border border-danger/40 bg-surface px-4 text-danger hover:border-danger hover:bg-danger-soft",
  link: "px-1 text-brand underline-offset-4 hover:underline",
};

/**
 * The classes of a button, for elements that cannot use Button or ButtonLink. `block` makes it full width, `pill`
 * fully round instead of the controls' 12px.
 */
export function buttonClass(
  variant: ButtonVariant = "primary",
  { block = false, size = "md", pill = false }: { block?: boolean; size?: ButtonSize; pill?: boolean } = {},
) {
  const shape = variant === "link" ? "" : pill ? " rounded-full" : " rounded-control";
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}${shape}${block ? " w-full" : ""}`;
}

type Common = { variant?: ButtonVariant; block?: boolean; size?: ButtonSize; pill?: boolean };

/** A small spinner in the text's colour, for an action on its way. */
export function Spinner({ className = "size-4" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

/**
 * `loading`: the action is on its way. The button shows a spinner before its label, says so to screen readers
 * (aria-busy) and ignores more presses until it is done, so a slow answer is never sent twice. It stays focusable
 * meanwhile (busyProps, #202): `disabled` is for a button that cannot be pressed yet, not for one that is working.
 */
export function Button({
  variant = "primary",
  block,
  size,
  pill,
  loading = false,
  className = "",
  type = "button",
  disabled,
  children,
  ...props
}: Common & { loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`${buttonClass(variant, { block, size, pill })} ${className}`.trim()}
      disabled={disabled}
      {...props}
      {...busyProps(loading)}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** A link that looks like a button: navigation (`href`) rather than an action. */
export function ButtonLink({
  variant = "primary",
  block,
  size,
  pill,
  className = "",
  ...props
}: Common & ComponentProps<typeof Link>) {
  return <Link className={`${buttonClass(variant, { block, size, pill })} ${className}`.trim()} {...props} />;
}
