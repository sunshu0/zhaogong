"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { saveMyJobAlert, type SaveAlertResult } from "@/app/[lang]/me/alerts/actions";
import { jobsHref } from "@/components/seeker/filter-query";
import { ALERT_LIMIT, ALERTS_PATH } from "@/components/seeker/job-alerts";
import { externalAlertHref } from "@/lib/external-jobs/alerts";
import type { ExternalSection } from "@/lib/external-jobs/filter";
import { useHydrated, useSession } from "@/components/seeker/session-client";

const ACTION =
  "inline-flex min-h-11 shrink-0 items-center gap-1 text-body text-brand underline-offset-4 hover:underline";

const SAID: Record<SaveAlertResult["status"], string> = {
  created: "已保存为提醒",
  exists: "已经是提醒了",
  limit: `提醒已满 ${ALERT_LIMIT} 个`,
};

/**
 * 保存为提醒 (#53): saves the list's filters; new jobs that match then show in 通知. Job seekers only; signed out,
 * it leads to sign-in and back to the same list. Keyed by the query on the page, so a new search starts over. With a
 * `section` it saves the filters of 实习 or 专业职位 (#131).
 */
export function SaveAlert({ query, section }: { query: string; section?: ExternalSection }) {
  const hydrated = useHydrated();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  if (!hydrated || session?.activeRole === "employer") return null;

  if (!session) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(section ? externalAlertHref({ section, query }) : jobsHref(query))}`}
        className={ACTION}
      >
        <Bell aria-hidden="true" className="size-4" />
        登录后保存为提醒
      </Link>
    );
  }

  if (said) {
    return (
      <p role="status" className="flex min-h-11 shrink-0 items-center gap-2 text-body text-muted">
        {said}
        <Link href={ALERTS_PATH} className="text-brand underline-offset-4 hover:underline">
          管理提醒
        </Link>
      </p>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      {failed && (
        <span role="alert" className="text-meta text-danger">
          没有保存，请重试
        </span>
      )}
      <button
        type="button"
        disabled={busy}
        className={`${ACTION} disabled:opacity-50`}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            const result = await saveMyJobAlert(query, section);
            setSaid(result ? SAID[result.status] : "请先登录");
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Bell aria-hidden="true" className="size-4" />
        保存为提醒
      </button>
    </span>
  );
}
