"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";

/**
 * The chat page failed as a whole (#178). Messages that were sent but not yet confirmed wait in this browser's
 * outbox (#10) and go out on the next load, so the card says so instead of the site's general error (#161).
 */
export default function MessagesError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusCard
      icon={TriangleAlert}
      title="聊天页面出了点问题"
      actions={
        <>
          <Button onClick={() => retry()}>重试</Button>
          <ButtonLink href="/workspace" variant="secondary">
            回工作台
          </ButtonLink>
        </>
      }
    >
      已经点了发送、还没送到的消息留在这台设备上，聊天页面下次打开时会自动发出。
    </StatusCard>
  );
}
