"use client";

import { catchError, type ErrorInfo } from "next/error";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { chatMessages } from "@/i18n/messages/chat";

/**
 * One part of a long flow (#178), such as a step of the posting form or an open chat, in its own error boundary
 * (Next 16 catchError): when it fails, only this part shows the message and 重试. What the user typed lives in state
 * outside the boundary, so it is still there after the retry.
 */
function PartFailed({ title, note }: { title: string; note?: string }, { error, retry }: ErrorInfo) {
  // catchError renders this through a component of its own, so a hook here is a hook in that component.
  const t = useMessages(chatMessages).retryBoundary;
  console.error(error);
  return (
    <div role="alert" className="type-app rounded-card bg-surface px-5 py-8 text-center shadow-card">
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-warn-soft text-warn">
        <TriangleAlert aria-hidden="true" className="size-5" />
      </span>
      <h2 className="mt-3 text-subtitle font-semibold">{title}</h2>
      {note && <p className="mt-1 text-body text-muted">{note}</p>}
      <Button className="mt-4" onClick={() => retry()}>
        {t.retry}
      </Button>
    </div>
  );
}

export const RetryBoundary = catchError(PartFailed);
