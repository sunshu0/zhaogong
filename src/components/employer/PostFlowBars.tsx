"use client";
// The sticky bars at the bottom of the form and preview steps of /employer/post.
import type { ReactNode } from "react";
import { holdReason, type DraftFormState } from "@/components/employer/use-draft-form";
import { WIDE_ON_DESKTOP } from "@/components/ui/wide";

const PRIMARY_BUTTON = "h-11 rounded-xl bg-brand px-5 font-semibold text-white disabled:opacity-40";

/** The sticky bar at the bottom of the form and preview steps; full width of the form on desktop. */
export function BottomBar({ wide, children }: { wide: boolean; children: ReactNode }) {
  return (
    <div
      className={`sticky bottom-0 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur ${wide ? WIDE_ON_DESKTOP : ""}`}
    >
      {children}
    </div>
  );
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
      <button type="button" onClick={onBack} className="text-sm text-muted underline">
        上一步
      </button>
      <p className="flex-1 text-xs text-muted">{formStatusText(form)}</p>
      <button type="button" disabled={!form.ready} onClick={onPreview} className={PRIMARY_BUTTON}>
        预览
      </button>
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
      <button type="button" onClick={onBack} className="text-sm text-muted underline">
        返回修改
      </button>
      <p className="flex-1 text-xs text-muted">{`以「${shopName}」发布`}</p>
      <button type="button" disabled={disabled} onClick={onPublish} className={PRIMARY_BUTTON}>
        {publishLabel(pending, needsReview)}
      </button>
    </div>
  );
}

function publishLabel(pending: boolean, needsReview: boolean): string {
  if (pending) return "发布中…";
  return needsReview ? "提交审核" : "发布";
}
