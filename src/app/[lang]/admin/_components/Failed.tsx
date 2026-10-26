"use client";

import { Button } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { adminMessages } from "@/i18n/messages/admin";
import { Section } from "@/components/ui/Section";

/** An action whose answer never came (#183), said in the card it was pressed in; what was typed there stays. */
export function TryAgain() {
  const t = useMessages(adminMessages);
  return (
    <p role="alert" className="animate-fade-in text-body text-danger">
      {t.tryAgain}
    </p>
  );
}

/** A load that got no answer (#183), in the place of the list it was for, with a button to ask again. */
export function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  const t = useMessages(adminMessages);
  return (
    <Section look="sheet">
      <div role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-body text-muted">{t.notLoaded(what)}</p>
        <Button variant="secondary" onClick={onRetry}>
          {t.retry}
        </Button>
      </div>
    </Section>
  );
}
