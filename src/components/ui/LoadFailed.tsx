"use client";

import { Button } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";

/**
 * A load that got no answer (#246), in the place of the list or card it was for, with a button to ask again. Without
 * it the page would wait on its skeleton for good. `what` is the page's own name for it, worded to go before 没取到
 * (「职位」, in English "your jobs").
 */
export function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  const t = useMessages(uiMessages).load;
  return (
    <div role="alert" className="rounded-card bg-surface px-4 py-8 text-center shadow-card">
      <p className="text-body text-muted">{t.notLoaded(what)}</p>
      <Button variant="secondary" onClick={onRetry} className="mt-3">
        {t.retry}
      </Button>
    </div>
  );
}
