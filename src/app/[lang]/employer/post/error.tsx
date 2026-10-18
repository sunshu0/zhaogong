"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";

/**
 * The posting page failed as a whole (#178). Unlike the site's error page (#161) it says that the draft is kept in
 * this tab (post-draft-store), so 重试 or coming back later picks up where the employer was.
 */
export default function PostError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusCard
      icon={TriangleAlert}
      title="发布页面出了点问题"
      actions={
        <>
          <Button onClick={() => retry()}>重试</Button>
          <ButtonLink href="/employer/jobs" variant="secondary">
            回到职位管理
          </ButtonLink>
        </>
      }
    >
      你写的招聘还存在这个标签页里，点重试或者稍后回来都能接着写。
    </StatusCard>
  );
}
