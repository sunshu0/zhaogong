"use client";
// The sticky bars at the bottom of the form and preview steps of /employer/post.
import { useId, type ReactNode } from "react";
import { holdReason, type DraftFormState } from "@/components/employer/use-draft-form";
import { Button } from "@/components/ui/Button";
import { BAR_TEXT_ACTION, STICKY_BAR } from "@/components/employer/app-style";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";
import { useLang, useMessages } from "@/i18n/client";
import { employerPostMessages } from "@/i18n/messages/employer-post";
import { contentLang, type Lang } from "@/i18n/lang";
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
  const statusId = useId();
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onBack} className={BAR_TEXT_ACTION}>
        {t.back}
      </button>
      <p id={statusId} className="flex-1 text-meta text-muted">
        {formStatusText(form, t, lang)}
      </p>
      {/* Not ready: aria-disabled, not disabled, so the keyboard and screen readers still reach it and hear why; a
          press goes to the first field that holds the form back (UI audit 1 #10). It looks as disabled as before:
          dimmed, the not-allowed cursor, pressed as hovered. */}
      <Button
        size="lg"
        aria-disabled={!form.ready || undefined}
        aria-describedby={form.ready ? undefined : statusId}
        onClick={() => (form.ready ? onPreview() : focusFirstProblem())}
        className="px-6 aria-disabled:pointer-events-auto! aria-disabled:cursor-not-allowed"
      >
        {t.preview}
      </Button>
    </div>
  );
}

/** The first field that holds the form back (不能发布：…, 没有识别到…; not a review-level note), top to bottom: its
 *  control, or a group's first one. */
function focusFirstProblem() {
  const note = document.querySelector<HTMLElement>('[id^="note-"][data-holds-form]');
  const field = note?.closest<HTMLElement>('[id^="field-"]');
  field?.querySelector<HTMLElement>("input, textarea, button")?.focus();
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
      {/* The shop's name is the employer's own, so it says which language it is in (ADR 0023 §6). */}
      <p className="min-w-0 flex-1 break-words text-meta text-muted">
        {t.postingAsBefore}
        <span lang={contentLang(shopName)}>{shopName}</span>
        {t.postingAsAfter}
      </p>
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
