"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusCard } from "@/components/seeker/StatusCard";

/** A page that failed while rendering: say so in Chinese and offer to try again, instead of Next's English page. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusCard
      icon={TriangleAlert}
      title="页面出了点问题"
      actions={
        <>
          <Button onClick={() => retry()}>重试</Button>
          <ButtonLink href="/" variant="secondary">
            回首页
          </ButtonLink>
        </>
      }
    >
      可能是网络不稳定，或者我们这边出了错。稍后再试一次；一直这样的话，请告诉我们。
    </StatusCard>
  );
}
