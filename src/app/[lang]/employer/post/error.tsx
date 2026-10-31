"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ErrorFocus } from "@/components/ui/ErrorFocus";
import { StatusCard } from "@/components/seeker/StatusCard";
import { useMessages } from "@/i18n/client";
import { employerPostMessages } from "@/i18n/messages/employer-post";

/**
 * The posting page failed as a whole (#178). Unlike the site's error page (#161) it says that the draft is kept in
 * this tab (post-draft-store), so 重试 or coming back later picks up where the employer was.
 */
export default function PostError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const t = useMessages(employerPostMessages).postError;
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorFocus>
      <StatusCard
        icon={TriangleAlert}
        title={t.title}
        actions={
          <>
            <Button onClick={() => retry()}>{t.retry}</Button>
            <ButtonLink href="/employer/jobs" variant="secondary">
              {t.backToJobs}
            </ButtonLink>
          </>
        }
      >
        {t.body}
      </StatusCard>
    </ErrorFocus>
  );
}
