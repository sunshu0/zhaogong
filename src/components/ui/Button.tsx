import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

/**
 * Three levels of action (Round 11): `primary` is solid brand, at most one per screen; `secondary` is outlined;
 * 6px corners and no shadow (Round 13);
 * `link` is a text link. Anything else goes into a MoreMenu.
 * Round 19: every button answers a press (`pressable`), and a Button can show that its action is on its way
 * (`loading`). `size="lg"` is the 48px main action of a screen, such as a bottom bar's.
 */
export type ButtonVariant = "primary" | "secondary" | "link";
export type ButtonSize = "md" | "lg";

const BASE =
  "pressable inline-flex items-center justify-center gap-2 text-body font-medium disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-busy:cursor-progress";
const SIZES: Record<ButtonSize, string> = { md: "min-h-11", lg: "min-h-12 text-subtitle" };
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "rounded-md bg-brand px-4 text-white hover:opacity-90",
  secondary: "rounded-md border border-brand/40 bg-surface px-4 text-brand hover:border-brand hover:bg-brand-soft",
  link: "px-1 text-brand underline-offset-4 hover:underline",
};

/** The classes of a button, for elements that cannot use Button or ButtonLink. `block` makes it full width. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  { block = false, size = "md" }: { block?: boolean; size?: ButtonSize } = {},
) {
  return `${BASE} ${SIZES[size]} ${VARIANTS[variant]}${block ? " w-full" : ""}`;
}

type Common = { variant?: ButtonVariant; block?: boolean; size?: ButtonSize };

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
 * (aria-busy) and ignores more presses until it is done, so a slow answer is never sent twice.
 */
export function Button({
  variant = "primary",
  block,
  size,
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
      className={`${buttonClass(variant, { block, size })} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
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
  className = "",
  ...props
}: Common & ComponentProps<typeof Link>) {
  return <Link className={`${buttonClass(variant, { block, size })} ${className}`.trim()} {...props} />;
}
