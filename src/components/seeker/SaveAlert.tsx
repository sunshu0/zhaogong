"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { saveMyJobAlert, type SaveAlertResult } from "@/app/[lang]/me/alerts/actions";
import { jobsHref } from "@/components/seeker/filter-query";
import { ALERT_LIMIT, ALERTS_PATH } from "@/components/seeker/job-alerts";
import { externalAlertHref } from "@/lib/external-jobs/alerts";
import type { ExternalSection } from "@/lib/external-jobs/filter";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { busyProps } from "@/components/ui/busy";
import { useMessages } from "@/i18n/client";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";

const ACTION =
  "inline-flex min-h-11 shrink-0 items-center gap-1 text-body text-brand underline-offset-4 hover:underline";

/** What 保存为提醒 turns into, by the server's answer (the words in seeker-me's alerts). */
const SAID: Record<SaveAlertResult["status"], "created" | "exists" | "limit"> = {
  created: "created",
  exists: "exists",
  limit: "limit",
};

/**
 * 保存为提醒 (#53): saves the list's filters; new jobs that match then show in 通知. Job seekers only; signed out,
 * it leads to sign-in and back to the same list. Keyed by the query on the page, so a new search starts over. With a
 * `section` it saves the filters of 实习 or 专业职位 (#131).
 */
export function SaveAlert({ query, section }: { query: string; section?: ExternalSection }) {
  const a = useMessages(seekerMeMessages).alerts;
  const hydrated = useHydrated();
  const session = useSession();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const manage = useRef<HTMLAnchorElement>(null);
  // 保存为提醒 turns into 已保存为提醒: the focus goes to its 管理提醒 (#202).
  useEffect(() => {
    if (said) manage.current?.focus();
  }, [said]);
  if (!hydrated || session?.activeRole === "employer") return null;

  if (!session) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(section ? externalAlertHref({ section, query }) : jobsHref(query))}`}
        className={ACTION}
      >
        <Bell aria-hidden="true" className="size-4" />
        {a.signInToSave}
      </Link>
    );
  }

  if (said) {
    return (
      <p role="status" className="flex min-h-11 shrink-0 items-center gap-2 text-body text-muted">
        {said}
        <Link ref={manage} href={ALERTS_PATH} className="text-brand underline-offset-4 hover:underline">
          {a.manage}
        </Link>
      </p>
    );
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      {failed && (
        <span role="alert" className="text-meta text-danger">
          {a.saveFailed}
        </span>
      )}
      <button
        type="button"
        className={`${ACTION} aria-disabled:opacity-50`}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          try {
            const result = await saveMyJobAlert(query, section);
            const said = result && SAID[result.status];
            setSaid(said ? (said === "limit" ? a.limit(ALERT_LIMIT) : a[said]) : a.signInFirst);
          } catch {
            setFailed(true);
          } finally {
            setBusy(false);
          }
        }}
        {...busyProps(busy)}
      >
        <Bell aria-hidden="true" className="size-4" />
        {a.saveAsAlert}
      </button>
    </span>
  );
}
