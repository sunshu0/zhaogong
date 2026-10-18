"use client";
import { useCallback, useState, useTransition } from "react";
import { regionById } from "@/config/countries";
import { REPORT_REASON_LABELS } from "@/i18n/labels";
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
} from "@/app/admin/actions";
import { isFailed, ready, settle } from "@/app/admin/load-state";
import { moderatorLabel } from "@/app/admin/moderation";
import { Cancel } from "@/app/admin/_components/Cancel";
import { Empty, Loading } from "@/app/admin/_components/Empty";
import { LoadFailed, TryAgain } from "@/app/admin/_components/Failed";
import { useAdminLoad } from "@/app/admin/_components/use-admin-load";
import { useSwapFocus } from "@/app/admin/_components/use-swap-focus";
import { ModeratorList } from "@/app/admin/_components/ModeratorList";
import { useVerificationQueue, VerificationQueue } from "@/app/admin/_components/VerificationQueue";
import { ExternalReview, useExternalReview } from "@/app/admin/_components/ExternalReview";
import {
  AiPostingUsage,
  ModerationSummary,
  ModerationWeeks,
  ModeratorWeeks,
  useModerationStats,
} from "@/app/admin/_components/ModerationStats";
import { FIELD_LABELS, FindingItem } from "@/components/employer/FindingsPanel";
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

const time = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Pacific/Auckland",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ModerationQueue() {
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
        <h1 className={TITLE}>审核后台</h1>
        <Empty>{answer.error_zh}</Empty>
      </div>
    );
  }
  const queue = ready(answer);
  const statsNow = ready(stats);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "flagged", label: "发布时被标记", count: queue?.flagged.length },
    { key: "reported", label: "被举报", count: queue?.reported.length },
    {
      key: "verification",
      label: "企业验证",
      count: ready(verifications)?.length,
    },
    {
      key: "external",
      label: "外部职位",
      count: ready(external)?.pending.length,
    },
    { key: "log", label: "操作记录", count: queue?.log.length },
    { key: "stats", label: "审核数据" },
    { key: "moderators", label: "审核员" },
  ];

  return (
    <div className="space-y-4">
      <h1 className={TITLE}>审核后台</h1>
      <ModerationSummary stats={stats} onRetry={reload} />
      <TabList
        label="审核队列"
        idBase="admin"
        tabs={tabs.map((t) => ({ key: t.key, label: `${t.label} ${t.count ?? ""}` }))}
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
          {result.ok ? `已处理：${result.text}` : result.error_zh}
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
            <LoadFailed what="审核数据" onRetry={reload} />
          ) : (
            <Loading />
          )
        ) : isFailed(answer) ? (
          <LoadFailed what="审核队列" onRetry={reload} />
        ) : !queue ? (
          <Loading />
        ) : tab === "log" ? (
          queue.log.length === 0 ? (
            <Empty>还没有处理记录。</Empty>
          ) : (
            <Section look="app">
              <ol className="divide-y divide-border">
                {queue.log.map((e) => (
                  <li key={e.id} className="flex gap-3 py-3 text-body">
                    <time dateTime={e.at} className="w-24 shrink-0 text-muted">
                      {time.format(new Date(e.at))}
                    </time>
                    <span className="min-w-0">
                      {e.text}
                      <span className="block text-meta text-muted">操作人：{moderatorLabel(e.moderator)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </Section>
          )
        ) : (
          <>
            {tab === "reported" && (
              <p className="mb-3 text-meta text-muted">这里只收录对职位的举报，聊天里的举报不在这里。</p>
            )}
            <QueueList
              items={tab === "flagged" ? queue.flagged : queue.reported}
              empty={tab === "flagged" ? "没有待审核的职位。" : "没有待处理的举报。"}
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
  // 确定封禁 takes focus itself (autoFocus); 取消 brings it back to 封禁雇主 (#189).
  const { opener: banOpenerRef } = useSwapFocus<HTMLSpanElement>(confirmBan);

  return (
    <article className={cardClass()}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="break-words text-subtitle font-semibold">{job.titleZh}</h2>
          <p className="truncate text-meta text-muted">
            <span lang="en" className="font-latin">
              {job.titleEn}
            </span>{" "}
            · {regionById(job.country, job.regionId)?.nameZh} · {job.id}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusTag status={job.status} />
          <p className="leading-none">
            <Pay pay={job.pay} country={job.country} />
          </p>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-body">
        <span>{employer?.name ?? job.employerId}</span>
        {employer && <VerificationBadge verification={employer.verification} />}
        {employer?.bannedAt && <Tag kind="urgent">已封禁</Tag>}
        <span className="text-meta text-muted">发布于 {time.format(new Date(job.postedAt))}</span>
      </p>
      <p className="mt-2 line-clamp-3 text-body whitespace-pre-line text-muted">{job.descriptionZh}</p>

      {reports && (
        <div className="mt-3 space-y-1.5">
          <h3 className="text-body font-medium">{reports.length} 条举报</h3>
          <ul className="space-y-1.5">
            {reports.map((r) => (
              <li key={r.id} className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger">
                <span className="font-medium">{REPORT_REASON_LABELS[r.reason].zh}</span>
                {r.note && <span>：{r.note}</span>}
                <span className="ml-1 text-meta">{time.format(new Date(r.createdAt))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {findings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <h3 className="text-body font-medium">规则检查</h3>
          {findings.map((f, i) => (
            <div key={i}>
              <p className="mb-1 text-meta text-muted">{FIELD_LABELS[f.field] ?? f.field}</p>
              <FindingItem finding={f} />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
        {reports ? (
          <Button
            variant="secondary"
            disabled={pending}
            loading={busy("dismiss")}
            onClick={() => run("dismiss", () => dismissReports(job.id))}
          >
            驳回举报
          </Button>
        ) : (
          <Button disabled={pending} loading={busy("approve")} onClick={() => run("approve", () => approveJob(job.id))}>
            没问题，通过
          </Button>
        )}
        <Button
          variant="danger-secondary"
          disabled={pending || job.status === "removed"}
          loading={busy("takedown")}
          onClick={() => run("takedown", () => takeDownJob(job.id))}
        >
          下架
        </Button>
        {/* Without the employer's record there is nobody to name or ban. */}
        <span ref={banOpenerRef} className="contents">
          {employer &&
            !employer.bannedAt &&
            (confirmBan ? (
              <>
                <Button
                  variant="danger"
                  disabled={pending}
                  loading={busy("ban")}
                  onClick={() => run("ban", () => banJobEmployer(job.id))}
                  autoFocus
                >
                  确定封禁「{employer.name}」并下架全部职位
                </Button>
                <Cancel onClick={() => setConfirmBan(false)} />
              </>
            ) : (
              <Button variant="danger-secondary" onClick={() => setConfirmBan(true)}>
                封禁雇主
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
