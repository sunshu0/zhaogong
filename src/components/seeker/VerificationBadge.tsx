import { VERIFICATION_LABELS } from "@/i18n/labels";
import type { EmployerVerification } from "@/lib/types";

const STYLES: Record<EmployerVerification, string> = {
  accredited_employer: "bg-brand-soft text-brand",
  business_verified: "bg-ok-soft text-ok",
  unverified: "border border-border text-muted",
};

export function VerificationBadge({ verification }: { verification: EmployerVerification }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs leading-none ${STYLES[verification]}`}
    >
      {verification !== "unverified" && (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3 fill-current">
          <path d="M6.4 11.2 3.2 8l1.1-1.1 2.1 2.1 5.3-5.3 1.1 1.1z" />
        </svg>
      )}
      {VERIFICATION_LABELS[verification].zh}
    </span>
  );
}
