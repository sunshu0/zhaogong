"use client";
// The sticky bars at the bottom of the form and preview steps of /employer/post.
import type { ReactNode } from "react";
import { holdReason, type DraftFormState } from "@/components/employer/use-draft-form";
import { Button } from "@/components/ui/Button";
import { BAR_TEXT_ACTION, STICKY_BAR } from "@/components/employer/app-style";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { useLang, useMessages } from "@/i18n/client";
import { employerPostMessages } from "@/i18n/messages/employer-post";
import type { Lang } from "@/i18n/lang";
import type { Messages } from "@/i18n/messages";

type Bars = Messages<(typeof employerPostMessages)["zh"]["bars"]>;

/** The sticky bar at the bottom of the form and preview steps; full width of the form on desktop. */
export function BottomBar({ wide, children }: { wide: boolean; children: ReactNode }) {
  return <div className={`${STICKY_BAR} ${wide ? WIDE_ON_DESKTOP : ""}`}>{children}</div>;
}

export function FormBar({
  form,
  onBack,
  onPreview,
}: {
  form: DraftFormState;
  onBack: () => void;
  onPreview: () => void;
}) {
  const lang = useLang();
  const t = useMessages(employerPostMessages).bars;
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onBack} className={BAR_TEXT_ACTION}>
        {t.back}
      </button>
      <p className="flex-1 text-meta text-muted">{formStatusText(form, t, lang)}</p>
      <Button size="lg" disabled={!form.ready} onClick={onPreview} className="px-6">
        {t.preview}
      </Button>
    </div>
  );
}

/** Below the form: whether it can be published, and if not, what is still open. */
function formStatusText({ ready, decision, findings, missing }: DraftFormState, t: Bars, lang: Lang): string {
  if (!ready) return holdReason(findings.length, missing.length, lang);
  return decision.status === "pending_review" ? t.readyNeedsReview : t.ready;
}

export function PreviewBar({
  shopName,
  disabled,
  pending,
  needsReview,
  onBack,
  onPublish,
}: {
  shopName: string;
  disabled: boolean;
  pending: boolean;
  needsReview: boolean;
  onBack: () => void;
  onPublish: () => void;
}) {
  const t = useMessages(employerPostMessages).bars;
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onBack} className={BAR_TEXT_ACTION}>
        {t.backToEdit}
      </button>
      <p className="flex-1 text-meta text-muted">{t.postingAs(shopName)}</p>
      <Button size="lg" loading={pending} disabled={disabled} onClick={onPublish} className="px-6">
        {publishLabel(pending, needsReview, t)}
      </Button>
    </div>
  );
}

function publishLabel(pending: boolean, needsReview: boolean, t: Bars): string {
  if (pending) return t.publishing;
  return needsReview ? t.submitForReview : t.publish;
}
