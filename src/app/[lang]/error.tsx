"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";
import { useMessages } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";

/** A page that failed while rendering: say so in the page's language and offer to try again, instead of Next's page. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useMessages(uiMessages).error;
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
          <ButtonLink href="/" variant="secondary">
            {t.home}
          </ButtonLink>
        </>
      }
    >
      {t.body}
    </StatusCard>
  );
}
