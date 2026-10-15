import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

/**
 * Three levels of action (Round 11): `primary` is solid brand, at most one per screen; `secondary` is outlined;
 * 6px corners and no shadow (Round 13);
 * `link` is a text link. Anything else goes into a MoreMenu.
 */
export type ButtonVariant = "primary" | "secondary" | "link";

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 text-body font-medium disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "rounded-md bg-brand px-4 text-white hover:opacity-90",
  secondary: "rounded-md border border-brand/40 bg-surface px-4 text-brand hover:border-brand hover:bg-brand-soft",
  link: "px-1 text-brand underline-offset-4 hover:underline",
};

/** The classes of a button, for elements that cannot use Button or ButtonLink. `block` makes it full width. */
export function buttonClass(variant: ButtonVariant = "primary", { block = false } = {}) {
  return `${BASE} ${VARIANTS[variant]}${block ? " w-full" : ""}`;
}

type Common = { variant?: ButtonVariant; block?: boolean };

export function Button({
  variant = "primary",
  block,
  className = "",
  type = "button",
  ...props
}: Common & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`${buttonClass(variant, { block })} ${className}`.trim()} {...props} />;
}

/** A link that looks like a button: navigation (`href`) rather than an action. */
export function ButtonLink({
  variant = "primary",
  block,
  className = "",
  ...props
}: Common & ComponentProps<typeof Link>) {
  return <Link className={`${buttonClass(variant, { block })} ${className}`.trim()} {...props} />;
}
