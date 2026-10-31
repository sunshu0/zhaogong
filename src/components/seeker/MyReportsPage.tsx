"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { myOpenReports } from "@/app/[lang]/me/reports/actions";
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import { useSentReports } from "@/components/seeker/activity-client";
import { useChat } from "@/components/seeker/chat-client";
import { formatJobDate } from "@/components/seeker/job-facts";
import { useHydrated } from "@/components/seeker/session-client";
import { sheetClass } from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useLang, useMessages } from "@/i18n/client";
import { chatMessages } from "@/i18n/messages/chat";
import { myReportsMessages } from "@/i18n/messages/my-reports";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { contentLang } from "@/i18n/lang";

type Open = { ids: Set<string> } | "checking" | "unknown";

/**
 * 我的举报 (S2, #390, ADR 0041): the job reports this device sent, each 处理中 while the server still has it open
 * for this browser's account or visitor id, else 已结束; and the reports made in chats, which stay in the person's
 * own chat records and have no state. Signed in or not: the list is this device's.
 */
export function MyReportsPage() {
  const lang = useLang();
  const t = useMessages(myReportsMessages);
  const loading = useMessages(seekerMeMessages).pages.loadingHistory;
  const reasons = useMessages(chatMessages).reportReasons;
  const hydrated = useHydrated();
  const reports = useSentReports();
  const chatReports = useChat().reports;
  const [open, setOpen] = useState<Open>("checking");
  const any = reports.length > 0;

  useEffect(() => {
    if (!any) return;
    let live = true;
    myOpenReports().then(
      (ids) => live && setOpen({ ids: new Set(ids) }),
      () => live && setOpen("unknown"),
    );
    return () => {
      live = false;
    };
  }, [any]);

  if (!hydrated) return <SkeletonList count={2} label={loading} />;

  const state = (reportId: string) =>
    open === "checking" ? t.checking : open === "unknown" ? t.unknown : open.ids.has(reportId) ? t.open : t.closed;

  return (
    <div className="space-y-3">
      <p className="px-1 text-body text-muted">{t.intro}</p>
      <Panel title={t.jobs} count={reports.length}>
        {!any ? (
          <p className="py-3 text-body text-muted">{t.noJobs}</p>
        ) : (
          <ul className="divide-y divide-border">
            {reports.map((r) => (
              <li key={r.reportId}>
                <Link href={`/jobs/${r.jobId}`} className={`${ROW} block py-2.5`}>
                  <span className="flex items-baseline justify-between gap-3">
                    <span lang={contentLang(r.jobTitle)} className="min-w-0 truncate text-body font-medium">
                      {r.jobTitle}
                    </span>
                    <span className="shrink-0 text-meta text-muted">{formatJobDate(r.at, "NZ", lang)}</span>
                  </span>
                  <span className="block text-meta text-muted">
                    {REPORT_REASON_LABELS[r.reason][lang]} · {state(r.reportId)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {chatReports.length > 0 && (
        <Panel title={t.chats} count={chatReports.length}>
          <p className="text-meta text-muted">{t.chatsNote}</p>
          <ul className="divide-y divide-border">
            {[...chatReports].reverse().map((r) => (
              <li key={r.id} className="py-2.5">
                <span className="flex items-baseline justify-between gap-3">
                  <span lang={contentLang(r.targetName)} className="min-w-0 truncate text-body font-medium">
                    {t.chatAbout(r.targetName)}
                  </span>
                  <span className="shrink-0 text-meta text-muted">{formatJobDate(r.createdAt, "NZ", lang)}</span>
                </span>
                <span className="block text-meta text-muted">{reasons[r.reason]}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <p className="px-1">
        <Link
          href="/safety"
          className="pressable inline-flex min-h-11 items-center text-body text-brand underline underline-offset-2"
        >
          {t.guide}
        </Link>
      </p>
    </div>
  );
}

function Panel({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={sheetClass()}>
      <h2 id={headingId} className="mb-1 flex min-h-11 items-center text-subtitle font-semibold">
        {title}
        {count > 0 && <span className="ml-1.5 text-body font-normal text-muted">{count}</span>}
      </h2>
      {children}
    </section>
  );
}

/** A row of a card's list: darkens while pressed, out to the card's edges. */
const ROW = "pressable-row -mx-4 px-4 hover:bg-background lg:-mx-5 lg:px-5";
