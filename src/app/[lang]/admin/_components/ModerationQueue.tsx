"use client";
import { useCallback, useState, useTransition } from "react";
import { regionById } from "@/config/countries";
import { placeName } from "@/components/seeker/format";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { formatDate } from "@/i18n/format";
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import { adminMessages } from "@/i18n/messages/admin";
import type { Report } from "@/lib/types";
import {
  approveJob,
  banJobEmployer,
  dismissReports,
  getModerationQueue,
  takeDownJob,
  type AdminResult,
  type ModerationQueue as Queue,
  type QueueItem,
  type Refused,
} from "@/app/[lang]/admin/actions";
import { isFailed, ready, settle } from "@/app/[lang]/admin/load-state";
import { moderatorLabel } from "@/app/[lang]/admin/moderation";
import { Cancel } from "@/app/[lang]/admin/_components/Cancel";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed, TryAgain } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import { useSwapFocus } from "@/app/[lang]/admin/_components/use-swap-focus";
import { ModeratorList } from "@/app/[lang]/admin/_components/ModeratorList";
import { useVerificationQueue, VerificationQueue } from "@/app/[lang]/admin/_components/VerificationQueue";
import { ExternalReview, useExternalReview } from "@/app/[lang]/admin/_components/ExternalReview";
import {
  AiPostingUsage,
  ModerationSummary,
  ModerationWeeks,
  ModeratorWeeks,
  useModerationStats,
} from "@/app/[lang]/admin/_components/ModerationStats";
import { FindingItem } from "@/components/employer/FindingsPanel";
import { pick } from "@/i18n/messages";
import { employerPostMessages } from "@/i18n/messages/employer-post";
import { TabList, TabPanel, UNDERLINE_TABS, underlineTab } from "@/components/employer/Tabs";

export const TITLE = "text-[1.75rem] leading-tight font-black";

/** The queue's tabs (Round 19): the employer pages' underlined tabs, darkening while pressed. */
const adminTab = (selected: boolean) => `${underlineTab(selected)} pressable-row rounded-t-control px-1`;
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { StatusTag } from "@/components/employer/StatusTag";
import { Button } from "@/components/ui/Button";
import { cardClass } from "@/components/ui/Card";
import { Pay } from "@/components/ui/Pay";
import { Section } from "@/components/ui/Section";
import { Tag } from "@/components/ui/Tag";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

type Tab = "flagged" | "reported" | "verification" | "external" | "log" | "stats" | "moderators";

// When a job was posted, a report made, a decision taken: day and time, New Zealand time (format.ts).
const TIME: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

export function ModerationQueue() {
  const lang = useLang();
  const t = useMessages(adminMessages);
  const [tab, setTab] = useState<Tab>("flagged");
  const [result, setResult] = useState<AdminResult>();
  const resultRef = useFocusOnChange<HTMLParagraphElement>(result);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  // Refused: not a moderator, or no signed-in session (it expired, or the browser's copy was stale).
  const answer = useAdminLoad<Queue | Refused>(getModerationQueue, version);
  const stats = useModerationStats(version); // #70
  const verifications = useVerificationQueue(version); // #78
  const external = useExternalReview(version); // #112

  const done = (r: AdminResult) => {
    setResult(r);
    reload();
  };

  if (answer && !isFailed(answer) && "refused" in answer) {
    return (
      <div className="space-y-4">
        <h1 className={TITLE}>{t.title}</h1>
        <Empty>{answer.error_zh}</Empty>
      </div>
    );
  }
  const queue = ready(answer);
  const statsNow = ready(stats);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "flagged", label: t.tabs.flagged, count: queue?.flagged.length },
    { key: "reported", label: t.tabs.reported, count: queue?.reported.length },
    {
      key: "verification",
      label: t.tabs.verification,
      count: ready(verifications)?.length,
    },
    {
      key: "external",
      label: t.tabs.external,
      count: ready(external)?.pending.length,
    },
    { key: "log", label: t.tabs.log, count: queue?.log.length },
    { key: "stats", label: t.tabs.stats },
    { key: "moderators", label: t.tabs.moderators },
  ];

  return (
    <div className="space-y-4">
      <h1 className={TITLE}>{t.title}</h1>
      <ModerationSummary stats={stats} onRetry={reload} />
      <TabList
        label={t.tabs.label}
        idBase="admin"
        tabs={tabs.map((tab) => ({ key: tab.key, label: `${tab.label} ${tab.count ?? ""}` }))}
        value={tab}
        onChange={setTab}
        className={UNDERLINE_TABS}
        tabClassName={adminTab}
      />

      {result && (
        <p
          ref={resultRef}
          tabIndex={-1}
          role="status"
          className={`animate-fade-in rounded-control px-4 py-3 text-body outline-none ${result.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}
        >
          {result.ok ? t.queue.done(result.text) : result.error_zh}
        </p>
      )}

      <TabPanel idBase="admin" value={tab}>
        {tab === "moderators" ? (
          <ModeratorList onDone={setResult} />
        ) : tab === "verification" ? (
          <VerificationQueue queue={verifications} onDone={done} onRetry={reload} />
        ) : tab === "external" ? (
          <ExternalReview queue={external} onDone={done} onRetry={reload} />
        ) : tab === "stats" ? (
          statsNow ? (
            <div className="space-y-section">
              <ModerationWeeks stats={statsNow} />
              <ModeratorWeeks stats={statsNow} />
              <AiPostingUsage stats={statsNow} />
            </div>
          ) : isFailed(stats) ? (
            <LoadFailed what={t.queue.statsName} onRetry={reload} />
          ) : (
            <Loading />
          )
        ) : isFailed(answer) ? (
          <LoadFailed what={t.queue.queueName} onRetry={reload} />
        ) : !queue ? (
          <Loading />
        ) : tab === "log" ? (
          queue.log.length === 0 ? (
            <Empty>{t.queue.noLog}</Empty>
          ) : (
            <Section look="app">
              <ol className="divide-y divide-border">
                {queue.log.map((e) => (
                  <li key={e.id} className="flex gap-3 py-3 text-body">
                    <time dateTime={e.at} className="w-24 shrink-0 text-muted">
                      {formatDate(e.at, lang, TIME)}
                    </time>
                    <span className="min-w-0">
                      {e.text}
                      <span className="block text-meta text-muted">
                        {t.queue.by(moderatorLabel(e.moderator, lang))}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          )
        ) : (
          <>
            {tab === "reported" && <p className="mb-3 text-meta text-muted">{t.queue.reportsOnlyJobs}</p>}
            <QueueList
              items={tab === "flagged" ? queue.flagged : queue.reported}
              empty={tab === "flagged" ? t.queue.noFlagged : t.queue.noReports}
              onDone={done}
            />
          </>
        )}
      </TabPanel>
    </div>
  );
}

function QueueList({
  items,
  empty,
  onDone,
}: {
  items: (QueueItem & { reports?: Report[] })[];
  empty: string;
  onDone: (r: AdminResult) => void;
}) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="space-y-3">
      {items.map((entry) => (
        <li key={entry.job.id}>
          <QueueCard item={entry} reports={entry.reports} onDone={onDone} />
        </li>
      ))}
    </ul>
  );
}

function QueueCard({
  item,
  reports,
  onDone,
}: {
  item: QueueItem;
  reports?: Report[];
  onDone: (r: AdminResult) => void;
}) {
  const lang = useLang();
  const t = useMessages(adminMessages);
  // Which field of the job a finding is about, named as the posting form names it (B's employer-post dictionary).
  const fieldNames: Record<string, string | undefined> = pick(employerPostMessages, lang).findings.fields;
  const { job, employer, findings } = item;
  const [pending, startTransition] = useTransition();
  // Which button was pressed, so only that one shows it is on its way.
  const [pressed, setPressed] = useState<string>();
  const [confirmBan, setConfirmBan] = useState(false);
  const [failed, setFailed] = useState(false); // #183: no answer came; the card stays as it was
  const run = (key: string, action: () => Promise<AdminResult>) => {
    setPressed(key);
    setFailed(false);
    startTransition(async () => {
      const result = await settle(action);
      if (result) onDone(result);
      else setFailed(true);
    });
  };
  const busy = (key: string) => pending && pressed === key;
  // #202: the pressed button only shows it is busy (Button loading keeps it focusable); the others in the card are
  // disabled meanwhile — they do not have the focus, so it is not lost.
  const another = (key: string) => pending && pressed !== key;
  // 确定封禁 takes focus itself (autoFocus); 取消 brings it back to 封禁雇主 (#189).
  const { opener: banOpenerRef } = useSwapFocus<HTMLSpanElement>(confirmBan);

  return (
    <article className={cardClass()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 lang={contentLang(job.titleZh)} className="break-words text-subtitle font-semibold">
            {job.titleZh}
          </h2>
          <p className="break-words text-meta text-muted">
            <span lang="en" className="font-latin">
              {job.titleEn}
            </span>{" "}
            · {placeName(regionById(job.country, job.regionId), lang)} · {job.id}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusTag status={job.status} />
          <p className="leading-none">
            <Pay pay={job.pay} country={job.country} lang={lang} />
          </p>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-body">
        <span lang={contentLang(employer?.name)}>{employer?.name ?? job.employerId}</span>
        {employer && <VerificationBadge verification={employer.verification} lang={lang} />}
        {employer?.bannedAt && <Tag kind="urgent">{t.queue.banned}</Tag>}
        <span className="text-meta text-muted">{t.queue.posted(formatDate(job.postedAt, lang, TIME))}</span>
      </p>
      <p lang={contentLang(job.descriptionZh)} className="mt-2 line-clamp-3 text-body whitespace-pre-line text-muted">
        {job.descriptionZh}
      </p>

      {reports && (
        <div className="mt-3 space-y-1.5">
          <h3 className="text-body font-medium">{t.queue.reportCount(reports.length)}</h3>
          <ul className="space-y-1.5">
            {reports.map((r) => (
              <li key={r.id} className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger">
                <span className="font-medium">{REPORT_REASON_LABELS[r.reason][lang]}</span>
                {r.note && (
                  <span>
                    {t.queue.noteSeparator}
                    <span lang={contentLang(r.note)}>{r.note}</span>
                  </span>
                )}
                <span className="ml-1 text-meta">{formatDate(r.createdAt, lang, TIME)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {findings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <h3 className="text-body font-medium">{t.queue.ruleChecks}</h3>
          {findings.map((f, i) => (
            <div key={i}>
              <p className="mb-1 text-meta text-muted">{fieldNames[f.field] ?? f.field}</p>
              <FindingItem finding={f} lang={lang} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        {reports ? (
          <Button
            variant="secondary"
            disabled={another("dismiss")}
            loading={busy("dismiss")}
            onClick={() => run("dismiss", () => dismissReports(job.id))}
          >
            {t.queue.dismiss}
          </Button>
        ) : (
          <Button
            disabled={another("approve")}
            loading={busy("approve")}
            onClick={() => run("approve", () => approveJob(job.id))}
          >
            {t.queue.approve}
          </Button>
        )}
        <Button
          variant="danger-secondary"
          disabled={another("takedown") || job.status === "removed"}
          loading={busy("takedown")}
          onClick={() => run("takedown", () => takeDownJob(job.id))}
        >
          {t.queue.takeDown}
        </Button>
        {/* Without the employer's record there is nobody to name or ban. */}
        <span ref={banOpenerRef} className="contents">
          {employer &&
            !employer.bannedAt &&
            (confirmBan ? (
              <>
                <Button
                  variant="danger"
                  disabled={another("ban")}
                  loading={busy("ban")}
                  onClick={() => run("ban", () => banJobEmployer(job.id))}
                  autoFocus
                >
                  {t.queue.confirmBan(employer.name)}
                </Button>
                <Cancel onClick={() => setConfirmBan(false)} />
              </>
            ) : (
              <Button variant="danger-secondary" onClick={() => setConfirmBan(true)}>
                {t.queue.ban}
              </Button>
            ))}
        </span>
      </div>
      {failed && (
        <div className="mt-3">
          <TryAgain />
        </div>
      )}
    </article>
  );
}
