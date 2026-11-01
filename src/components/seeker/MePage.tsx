"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import { forgetViews, useSentReports, useViewedJobs } from "@/components/seeker/activity-client";
import { formatJobDate } from "@/components/seeker/job-facts";
import { useHydrated, useSession } from "@/components/seeker/session-client";
import { ManageJobs } from "@/components/employer/ManageJobs";
import { ButtonLink } from "@/components/ui/Button";
import { sheetClass } from "@/components/ui/Card";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useLang, useMessages } from "@/i18n/client";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { contentLang } from "@/i18n/lang";

/**
 * /me (浏览与举报): jobs viewed and reports sent from this device. Account and sign-out are on 我的 (/account).
 * Round 19: the sample's type, each list a card, rows that darken while pressed.
 */
export function MePage({ demo = false }: { demo?: boolean }) {
  const lang = useLang();
  const t = useMessages(seekerMeMessages);
  const h = t.history;
  const hydrated = useHydrated();
  const session = useSession();
  const views = useViewedJobs();
  const reports = useSentReports();
  // After 确认清除 the whole confirm goes with the list: the focus goes to the panel's heading and the status line
  // says it was cleared, so the keyboard is not dropped on <body> (visual-1 review).
  // Counted, so a second 确认清除 moves the focus and is said again; the line goes once there is history again.
  const [cleared, setCleared] = useState(0);
  const viewedHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (cleared > 0) viewedHeading.current?.focus();
  }, [cleared]);

  if (!hydrated) return <SkeletonList count={2} label={t.pages.loadingHistory} />;

  if (!session) {
    return (
      <div className={`py-10 text-center ${sheetClass()}`}>
        <p className="text-body font-medium">{h.signInFor}</p>
        <ButtonLink href="/login?next=%2Fme" className="mt-4">
          {t.pages.signIn}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {session.activeRole === "employer" ? (
        <section className="space-y-3" aria-label={h.records}>
          <h2 className="text-subtitle font-semibold">{h.records}</h2>
          <ManageJobs />
        </section>
      ) : (
        <Panel
          title={h.viewed}
          count={views.length}
          headingRef={viewedHeading}
          action={
            views.length > 0 && (
              <ClearViews
                onClear={() => {
                  forgetViews();
                  setCleared((n) => n + 1);
                }}
              />
            )
          }
        >
          <p role="status" className="sr-only">
            {cleared > 0 && views.length === 0 && <span key={cleared}>{h.cleared}</span>}
          </p>
          {views.length === 0 ? (
            <>
              <Empty>{h.noneViewed}</Empty>
              {/* The way on is a button, as on the saved jobs and applications pages (UI audit 3). */}
              <ButtonLink href="/jobs" variant="secondary" className="mb-1">
                {h.browse}
              </ButtonLink>
            </>
          ) : (
            <ul className="divide-y divide-border">
              {views.map((v) => (
                <li key={v.jobId}>
                  <Link
                    href={`/jobs/${v.jobId}`}
                    className={`${ROW} flex min-h-14 items-center justify-between gap-3 py-2.5`}
                  >
                    <span className="min-w-0">
                      <span lang={contentLang(v.title)} className="block truncate text-body font-medium">
                        {v.title}
                      </span>
                      {/* Kept as the job page said them when the job was viewed, in its language then. */}
                      <span lang={contentLang(`${v.pay}${v.region}`)} className="block truncate text-meta text-muted">
                        {v.pay} · {v.region}
                      </span>
                    </span>
                    <span className="shrink-0 text-meta text-muted">{formatJobDate(v.at, "NZ", lang)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      <Panel
        title={h.reports}
        count={reports.length}
        action={
          reports.length > 0 && (
            <Link
              href="/me/reports"
              className="pressable inline-flex min-h-11 items-center text-meta text-brand underline underline-offset-2"
            >
              {h.progress}
            </Link>
          )
        }
      >
        {reports.length === 0 ? (
          <Empty>{h.noReports}</Empty>
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
                    {h.reportStatus(REPORT_REASON_LABELS[r.reason][lang])}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="px-1 text-meta text-muted">{h.storageNote(demo)}</p>
    </div>
  );
}

function Panel({
  title,
  count,
  action,
  headingRef,
  children,
}: {
  title: string;
  count: number;
  action?: ReactNode;
  /** Set where the focus may be sent to the heading. */
  headingRef?: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={sheetClass()}>
      <div className="mb-1 flex min-h-11 items-center justify-between gap-3">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={headingRef ? -1 : undefined}
          className="text-subtitle font-semibold outline-none"
        >
          {title}
          {count > 0 && <span className="ml-1.5 text-body font-normal text-muted">{count}</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/**
 * 清除浏览记录 asks once, in the row, as 提醒's 删除 does (UI audit 3): the history is on this device only and does
 * not come back. The focus follows the swap, so the keyboard stays where it was.
 */
function ClearViews({ onClear }: { onClear: () => void }) {
  const h = useMessages(seekerMeMessages).history;
  const [confirming, setConfirming] = useState(false);
  const swapped = useRef(false);
  const clearButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const warningId = useId();
  useEffect(() => {
    if (!swapped.current) return;
    (confirming ? confirmButton : clearButton).current?.focus();
  }, [confirming]);
  const swap = (next: boolean) => {
    swapped.current = true;
    setConfirming(next);
  };
  const small = "pressable inline-flex min-h-11 items-center px-1 text-body underline-offset-4";
  return confirming ? (
    <span className="flex flex-wrap items-center justify-end gap-x-2 text-body">
      <span id={warningId} className="text-muted">
        {h.clearWarning}
      </span>
      <button
        ref={confirmButton}
        type="button"
        aria-describedby={warningId}
        onClick={onClear}
        className={`${small} font-medium text-danger hover:underline`}
      >
        {h.confirmClear}
      </button>
      <button type="button" onClick={() => swap(false)} className={`${small} text-brand hover:underline`}>
        {h.cancel}
      </button>
    </span>
  ) : (
    <button ref={clearButton} type="button" onClick={() => swap(true)} className={`${small} text-muted underline`}>
      {h.clear}
    </button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-body text-muted">{children}</p>;
}

/** A row of a card's list: darkens while pressed, out to the card's edges. */
const ROW = "pressable-row -mx-4 px-4 hover:bg-background lg:-mx-5 lg:px-5";
