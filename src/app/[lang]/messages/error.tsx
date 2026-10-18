"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";
import { useMessages } from "@/i18n/client";
import { chatMessages } from "@/i18n/messages/chat";

/**
 * The chat page failed as a whole (#178). Messages that were sent but not yet confirmed wait in this browser's
 * outbox (#10) and go out on the next load, so the card says so instead of the site's general error (#161).
 */
export default function MessagesError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useMessages(chatMessages).errorPage;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusCard
      icon={TriangleAlert}
      title={t.title}
      actions={
        <>
          <Button onClick={() => retry()}>{t.retry}</Button>
          <ButtonLink href="/workspace" variant="secondary">
            {t.backToWorkspace}
          </ButtonLink>
        </>
      }
    >
      {t.body}
    </StatusCard>
  );
}
