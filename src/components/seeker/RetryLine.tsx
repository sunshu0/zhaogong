"use client";

import { Button } from "@/components/ui/Button";
import { useMessages } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";

/**
 * A load's own failure line with 重试 beside it (#254): for the places that already say what did not load in their
 * own words (收藏, 提醒, 申请记录, 联系方式), so the person can ask again without reloading the page.
 */
export function RetryLine({
  text,
  onRetry,
  className = "",
}: {
  text: string;
  onRetry: () => void;
  className?: string;
}) {
  const t = useMessages(uiMessages).load;
  return (
    <div role="alert" className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`.trim()}>
      <p className="text-body text-danger">{text}</p>
      <Button variant="link" onClick={onRetry}>
        {t.retry}
      </Button>
    </div>
  );
}
