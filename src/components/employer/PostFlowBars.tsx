"use client";
// The sticky bars at the bottom of the form and preview steps of /employer/post.
import type { ReactNode } from "react";
import { holdReason, type DraftFormState } from "@/components/employer/use-draft-form";
import { Button } from "@/components/ui/Button";
import { BAR_TEXT_ACTION, STICKY_BAR } from "@/components/employer/app-style";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";

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
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onBack} className={BAR_TEXT_ACTION}>
        上一步
      </button>
      <p className="flex-1 text-meta text-muted">{formStatusText(form)}</p>
      <Button size="lg" disabled={!form.ready} onClick={onPreview} className="px-6">
        预览
      </Button>
    </div>
  );
}

/** Below the form: whether it can be published, and if not, what is still open. */
function formStatusText({ ready, decision, findings, missing }: DraftFormState): string {
  if (!ready) return holdReason(findings.length, missing.length);
  return decision.status === "pending_review" ? "可以发布，需人工审核" : "可以发布";
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
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={onBack} className={BAR_TEXT_ACTION}>
        返回修改
      </button>
      <p className="flex-1 text-meta text-muted">{`以「${shopName}」发布`}</p>
      <Button size="lg" loading={pending} disabled={disabled} onClick={onPublish} className="px-6">
        {publishLabel(pending, needsReview)}
      </Button>
    </div>
  );
}

function publishLabel(pending: boolean, needsReview: boolean): string {
  if (pending) return "发布中…";
  return needsReview ? "提交审核" : "发布";
}
