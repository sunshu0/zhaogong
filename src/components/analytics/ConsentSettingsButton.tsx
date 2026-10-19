"use client";

import { useMessages } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";
import { CLARITY_SETUP, OPEN_CONSENT_EVENT } from "@/components/analytics/flags";
import { clarityConfigured } from "@/lib/analytics/clarity-rules";
import { Button } from "@/components/ui/Button";

/** 统计设置 in the footer (#313, ADR 0025 §7): opens the consent prompt again. Only where Clarity is set up. */
export function ConsentSettingsButton() {
  const t = useMessages(uiMessages).consent;
  if (!clarityConfigured(CLARITY_SETUP)) return null;
  return (
    <Button variant="link" onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}>
      {t.settings}
    </Button>
  );
}
