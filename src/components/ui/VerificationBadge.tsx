import { VERIFICATION_LABELS } from "@/i18n/labels";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { uiMessages } from "@/i18n/messages/ui";
import type { EmployerVerification } from "@/lib/types";

/** Three levels you can tell apart at a glance: accredited is solid, verified is light, unverified is grey. */
const STYLES: Record<EmployerVerification, string> = {
  accredited_employer: "bg-brand text-white",
  business_verified: "bg-brand-soft text-brand",
  unverified: "bg-neutral-soft text-muted",
};

/**
 * One sentence per level, for a title or next to the badge on detail pages. Facts only, no visa advice. In Chinese;
 * the badge takes its language's from the ui dictionary.
 */
export const VERIFICATION_EXPLANATIONS: Record<EmployerVerification, string> = uiMessages.zh.verification;

/**
 * The employer's verification level. The explanation is the badge's title; pass `explain` to also print it
 * after the badge (detail pages, where there is room and no hover on phones).
 */
export function VerificationBadge({
  verification,
  explain = false,
  lang = DEFAULT_LANG,
}: {
  verification: EmployerVerification;
  explain?: boolean;
  /** The page's language (Round 20): it renders on the server and in the browser, so it is told rather than asking. */
  lang?: Lang;
}) {
  const explanation = pick(uiMessages, lang).verification[verification];
  const badge = (
    <span
      title={explanation}
      className={`inline-flex w-fit items-center gap-0.5 rounded px-1.5 py-0.5 text-meta leading-none ${STYLES[verification]}`}
    >
      {verification !== "unverified" && (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3 fill-current">
          <path d="M6.4 11.2 3.2 8l1.1-1.1 2.1 2.1 5.3-5.3 1.1 1.1z" />
        </svg>
      )}
      {VERIFICATION_LABELS[verification][lang]}
    </span>
  );
  if (!explain) return badge;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      {badge}
      <span className="text-meta text-muted">{explanation}</span>
    </span>
  );
}
