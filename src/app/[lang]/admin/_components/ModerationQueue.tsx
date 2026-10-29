"use client";
import { Suspense, useCallback, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { regionById } from "@/config/countries";
import { placeName } from "@/components/seeker/format";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang } from "@/i18n/lang";
import { formatDate } from "@/i18n/format";
import { REPORT_REASON_LABELS } from "@/i18n/labels";
import { adminMessages } from "@/i18n/messages/admin";
import {
  approveJob,
  dismissReports,
  getModerationQueue,
  takeDownJob,
  type AdminResult,
  type ModerationQueue as Queue,
  type QueueItem,
  type ReportInQueue,
  type Refused,
} from "@/app/[lang]/admin/actions";
import { isFailed, ready, settle } from "@/app/[lang]/admin/load-state";
import { approveBlocker, moderatorLabel } from "@/app/[lang]/admin/moderation";
import { BanChoice } from "@/app/[lang]/admin/_components/BanChoice";
import { Empty, Loading } from "@/app/[lang]/admin/_components/Empty";
import { LoadFailed, TryAgain } from "@/app/[lang]/admin/_components/Failed";
import { useAdminLoad } from "@/app/[lang]/admin/_components/use-admin-load";
import { useSwapFocus } from "@/components/ui/use-swap-focus";
import { Funnels } from "@/app/[lang]/admin/_components/Funnels";
import { ModeratorChanges } from "@/app/[lang]/admin/_components/ModeratorChanges";
import { ModeratorList } from "@/app/[lang]/admin/_components/ModeratorList";
import { TempBans } from "@/app/[lang]/admin/_components/TempBans";
import { StartChatButton, unreadChats, useModeratorChatList } from "@/app/[lang]/admin/_components/ModeratorChats";
import { conversationAddress } from "@/components/seeker/fullscreen-chat";
import { moderatorChatMessages } from "@/i18n/messages/moderator-chat";
import { PersonalInfoViews } from "@/app/[lang]/admin/_components/PersonalInfoViews";
import { ReportEvidenceView } from "@/app/[lang]/admin/_components/ReportEvidenceView";
import { ChatRiskQueue, useChatRiskQueue } from "@/app/[lang]/admin/_components/ChatRiskQueue";
import { adminViewsMessages } from "@/i18n/messages/admin-views";
import { useVerificationQueue, VerificationQueue } from "@/app/[lang]/admin/_components/VerificationQueue";
import { ExternalReview, useExternalReview } from "@/app/[lang]/admin/_components/ExternalReview";
import { PhotoQueue, usePhotoQueue } from "@/app/[lang]/admin/_components/PhotoQueue";
import { employerPhotosMessages } from "@/i18n/messages/employer-photos";
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
import { PILL_TABS, TabList, TabPanel, UNDERLINE_TABS, pillTab, underlineTab } from "@/components/employer/Tabs";
import { useSession } from "@/components/seeker/session-client";

// The 聊天 group's list and conversation load when the group opens: they share ChatThread's composer with 消息, which
// would otherwise come with every visit to /admin (ADR 0046, performance budget).
const ModeratorChats = dynamic(
  () => import("@/app/[lang]/admin/_components/ModeratorChatBoard").then((m) => m.ModeratorChats),
  { ssr: false, loading: () => <Loading cards={1} /> },
);

export const TITLE = "text-[1.75rem] leading-tight font-black";

/** The queue's tabs (Round 19): the employer pages' underlined tabs, darkening while pressed. */
const adminTab = (selected: boolean) => `${underlineTab(selected)} pressable-row rounded-t-control px-1`;
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { StatusTag } from "@/components/employer/StatusTag";
import { Button } from "@/components/ui/Button";
import { sheetClass } from "@/components/ui/Card";
import { Pay } from "@/components/ui/Pay";
import { Section } from "@/components/ui/Section";
import { Tag } from "@/components/ui/Tag";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

/**
 * ADR 0043: the page in two groups, as a moderator works through it — 待处理 (what waits for a decision, each with how
 * many) and 记录与统计 (what was done, the numbers, who saw whose details, the moderators).
 */
type TodoTab = "flagged" | "reported" | "chatRisk" | "verification" | "external" | "photos";
type RecordTab = "log" | "stats" | "views" | "tempBans" | "moderators" | "changes";
type Tab = TodoTab | RecordTab;
/** ADR 0046: 聊天, the conversations with businesses, the third group. */
type Group = "todo" | "records" | "chat";

// When a job was posted, a report made, a decision taken: day and time, New Zealand time (format.ts).
const TIME: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" };

export function ModerationQueue() {
  const lang = useLang();
  const t = useMessages(adminMessages);
  const tv = useMessages(adminViewsMessages);
  const admin = useSession()?.staff === "admin";
  // A conversation in the address (?conversation=, a reload or a link) opens the 聊天 group. This renders only
  // after hydration (SignInGate), so the address is there to read.
  const [group, setGroup] = useState<Group>(() =>
    new URLSearchParams(window.location.search).has("conversation") ? "chat" : "todo",
  );
  // Each group remembers its tab while the other is open.
  const [todoTab, setTodoTab] = useState<TodoTab>("flagged");
  const [recordTab, setRecordTab] = useState<RecordTab>("log");
  const tab: Tab = group === "todo" ? todoTab : recordTab;
  const [result, setResult] = useState<AdminResult>();
  const resultRef = useFocusOnChange<HTMLParagraphElement>(result);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  // Refused: not a moderator, or no signed-in session (it expired, or the browser's copy was stale).
  const answer = useAdminLoad<Queue | Refused>(getModerationQueue, version);
  const stats = useModerationStats(version); // #70
  // #78; asked only on its tab, as each application it hands over is recorded (#336). The tab counts from the stats.
  const verifications = useVerificationQueue(version, tab === "verification");
  const external = useExternalReview(version); // #112
  const chatRisk = useChatRiskQueue(version); // #384: names and counts only; the messages load when opened
  const photos = usePhotoQueue(version); // ADR 0052: names and times; the pictures load on its tab
  const chats = useModeratorChatList(version, group === "chat"); // ADR 0046
  const tc = useMessages(moderatorChatMessages).admin;
  const tp = useMessages(employerPhotosMessages).admin;

  const done = (r: AdminResult) => {
    setResult(r);
    reload();
  };
  /** 和企业聊天 opened a business's conversation: show it in the 聊天 group. */
  const openChat = (employerId: string) => {
    window.history.replaceState(null, "", conversationAddress(window.location, employerId));
    setResult(undefined);
    setGroup("chat");
    chats.refresh();
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

  const todoTabs: { key: TodoTab; label: string; count?: number }[] = [
    { key: "flagged", label: t.tabs.flagged, count: queue?.flagged.length },
    { key: "reported", label: t.tabs.reported, count: queue?.reported.length },
    { key: "chatRisk", label: tv.chatRisk.tab, count: ready(chatRisk)?.items.length },
    {
      key: "verification",
      label: t.tabs.verification,
      count: ready(verifications)?.length ?? statsNow?.pendingVerifications,
    },
    {
      key: "external",
      label: t.tabs.external,
      count: ready(external)?.pending.length,
    },
    { key: "photos", label: tp.tab, count: ready(photos)?.length },
  ];
  const recordTabs: { key: RecordTab; label: string; count?: number }[] = [
    { key: "log", label: t.tabs.log, count: queue?.log.length },
    { key: "stats", label: t.tabs.stats },
    { key: "views", label: tv.tab },
    { key: "tempBans", label: t.tabs.tempBans },
    { key: "moderators", label: t.tabs.moderators },
    ...(admin ? [{ key: "changes" as const, label: t.tabs.changes }] : []),
  ];
  // What waits, on the group's own entry: known once every queue has answered.
  const counts = todoTabs.map((x) => x.count);
  const waiting = counts.every((n): n is number => n !== undefined) ? counts.reduce((a, b) => a + b, 0) : undefined;
  const labelled = <K extends Tab>(list: { key: K; label: string; count?: number }[]) =>
    list.map((x) => ({ key: x.key, label: `${x.label} ${x.count ?? ""}` }));

  return (
    <div className="space-y-4">
      <h1 className={TITLE}>{t.title}</h1>
      <TabList
        label={t.groups.label}
        idBase="admin-group"
        tabs={[
          { key: "todo", label: `${t.groups.todo} ${waiting ?? ""}` },
          { key: "records", label: t.groups.records },
          { key: "chat", label: `${tc.group} ${unreadChats(chats.list) || ""}` },
        ]}
        value={group}
        onChange={setGroup}
        className={PILL_TABS}
        tabClassName={pillTab}
      />
      <TabPanel idBase="admin-group" value={group} className="space-y-4">
        {group === "chat" ? (
          <Suspense fallback={<Loading cards={1} />}>
            <ModeratorChats list={chats.list} refresh={chats.refresh} />
          </Suspense>
        ) : (
          <>
            {group === "todo" && <ModerationSummary stats={stats} onRetry={reload} />}
            {group === "todo" ? (
              <TabList
                label={t.tabs.label}
                idBase="admin"
                tabs={labelled(todoTabs)}
                value={todoTab}
                onChange={setTodoTab}
                className={UNDERLINE_TABS}
                tabClassName={adminTab}
              />
            ) : (
              <TabList
                label={t.groups.records}
                idBase="admin"
                tabs={labelled(recordTabs)}
                value={recordTab}
                onChange={setRecordTab}
                className={UNDERLINE_TABS}
                tabClassName={adminTab}
              />
            )}

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
              {tab === "changes" ? (
                <ModeratorChanges />
              ) : tab === "tempBans" ? (
                <TempBans onDone={done} onChat={openChat} />
              ) : tab === "moderators" ? (
                <ModeratorList onDone={setResult} />
              ) : tab === "views" ? (
                <PersonalInfoViews />
              ) : tab === "chatRisk" ? (
                <ChatRiskQueue queue={chatRisk} onDone={done} onRetry={reload} />
              ) : tab === "verification" ? (
                <VerificationQueue queue={verifications} onDone={done} onRetry={reload} onChat={openChat} />
              ) : tab === "external" ? (
                <ExternalReview queue={external} onDone={done} onRetry={reload} />
              ) : tab === "photos" ? (
                <PhotoQueue queue={photos} onDone={done} onRetry={reload} />
              ) : tab === "stats" ? (
                statsNow ? (
                  <div className="space-y-section">
                    <ModerationWeeks stats={statsNow} />
                    <ModeratorWeeks stats={statsNow} />
                    <AiPostingUsage stats={statsNow} />
                    <Funnels />
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
                  <Section look="sheet">
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
                    onChat={tab === "reported" ? openChat : undefined}
                  />
                </>
              )}
            </TabPanel>
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
  onChat,
}: {
  items: (QueueItem & { reports?: ReportInQueue[] })[];
  empty: string;
  onDone: (r: AdminResult) => void;
  onChat?: (employerId: string) => void;
}) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="space-y-3">
      {items.map((entry) => (
        <li key={entry.job.id}>
          <QueueCard item={entry} reports={entry.reports} onDone={onDone} onChat={onChat} />
        </li>
      ))}
    </ul>
  );
}

function QueueCard({
  item,
  reports,
  onDone,
  onChat,
}: {
  item: QueueItem;
  reports?: ReportInQueue[];
  onDone: (r: AdminResult) => void;
  onChat?: (employerId: string) => void;
}) {
  const lang = useLang();
  const t = useMessages(adminMessages);
  // Which field of the job a finding is about, named as the posting form names it (B's employer-post dictionary).
  const fieldNames: Record<string, string | undefined> = pick(employerPostMessages, lang).findings.fields;
  const { job, employer, findings } = item;
  // #295: what approveJob would refuse, said under 通过, which waits: a banned employer, or a job today's rules still
  // stop (the findings here are checked against them when the queue is read, as the server checks on 通过).
  const blocker = approveBlocker(employer, findings);
  const cannotApprove = blocker && t.errors[blocker];
  const whyNotId = `why-not-approve-${job.id}`;
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
    <article className={sheetClass()}>
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
        {employer?.bannedAt && (
          <Tag kind="urgent">
            {employer.bannedUntil ? t.queue.tempBanned(formatDate(employer.bannedUntil, lang, TIME)) : t.queue.banned}
          </Tag>
        )}
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
                {r.evidence && <ReportEvidenceView reportId={r.id} counts={r.evidence} />}
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
            variant="secondary"
            disabled={another("approve") || !!cannotApprove}
            loading={busy("approve")}
            aria-describedby={cannotApprove ? whyNotId : undefined}
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
        {!reports && cannotApprove && (
          <p id={whyNotId} className="w-full text-meta text-danger">
            {cannotApprove}
          </p>
        )}
        {/* Without the employer's record there is nobody to name or ban. */}
        <span ref={banOpenerRef} className="contents">
          {employer &&
            !employer.bannedAt &&
            (confirmBan ? (
              <BanChoice
                jobId={job.id}
                employerName={employer.name}
                run={run}
                busy={busy("ban")}
                disabled={another("ban")}
                onCancel={() => setConfirmBan(false)}
              />
            ) : (
              <Button variant="danger-secondary" onClick={() => setConfirmBan(true)}>
                {t.queue.ban}
              </Button>
            ))}
        </span>
        {/* ADR 0046: ask the business about it, or hear it out. */}
        {reports && employer && onChat && (
          <StartChatButton employerId={employer.id} from="report" onOpen={onChat} onDone={onDone} />
        )}
      </div>
      {failed && (
        <div className="mt-3">
          <TryAgain />
        </div>
      )}
    </article>
  );
}
