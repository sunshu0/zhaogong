"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
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
import { moderatorLabel } from "@/app/admin/moderation";
import { Empty } from "@/app/admin/_components/Empty";
import { ModeratorList } from "@/app/admin/_components/ModeratorList";
import {
  ModerationSummary,
  ModerationWeeks,
  ModeratorWeeks,
  useModerationStats,
} from "@/app/admin/_components/ModerationStats";
import { FIELD_LABELS, FindingItem } from "@/components/employer/FindingsPanel";
import { TabList, TabPanel, UNDERLINE_TABS, underlineTab } from "@/components/employer/Tabs";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { StatusTag } from "@/components/employer/StatusTag";
import { Pay } from "@/components/ui/Pay";
import { Section } from "@/components/ui/Section";
import { Tag } from "@/components/ui/Tag";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

type Tab = "flagged" | "reported" | "log" | "stats" | "moderators";

const time = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Pacific/Auckland",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function ModerationQueue() {
  // Refused: not a moderator, or no signed-in session (it expired, or the browser's copy was stale).
  const [answer, setAnswer] = useState<Queue | Refused>();
  const [tab, setTab] = useState<Tab>("flagged");
  const [result, setResult] = useState<AdminResult>();
  const resultRef = useFocusOnChange<HTMLParagraphElement>(result);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const stats = useModerationStats(version); // #70

  useEffect(() => {
    let live = true;
    getModerationQueue().then((q) => {
      if (live) setAnswer(q);
    });
    return () => {
      live = false;
    };
  }, [version]);

  const done = (r: AdminResult) => {
    setResult(r);
    reload();
  };

  if (answer && "refused" in answer) {
    return (
      <div className="space-y-4">
        <h1 className="text-title font-semibold">审核后台</h1>
        <Empty>{answer.error_zh}</Empty>
      </div>
    );
  }
  const queue = answer;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "flagged", label: "发布时被标记", count: queue?.flagged.length },
    { key: "reported", label: "被举报", count: queue?.reported.length },
    { key: "log", label: "操作记录", count: queue?.log.length },
    { key: "stats", label: "审核数据" },
    { key: "moderators", label: "审核员" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-title font-semibold">审核后台</h1>
      <ModerationSummary stats={stats && !("refused" in stats) ? stats : undefined} />
      <TabList
        label="审核队列"
        idBase="admin"
        tabs={tabs.map((t) => ({ key: t.key, label: `${t.label} ${t.count ?? ""}` }))}
        value={tab}
        onChange={setTab}
        className={UNDERLINE_TABS}
        tabClassName={underlineTab}
      />

      {result && (
        <p
          ref={resultRef}
          tabIndex={-1}
          role="status"
          className={`rounded-md px-3 py-2 text-body outline-none ${result.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}
        >
          {result.ok ? `已处理：${result.text}` : result.error_zh}
        </p>
      )}

      <TabPanel idBase="admin" value={tab}>
        {tab === "moderators" ? (
          <ModeratorList onDone={setResult} />
        ) : tab === "stats" ? (
          stats && !("refused" in stats) ? (
            <div className="space-y-section">
              <ModerationWeeks stats={stats} />
              <ModeratorWeeks stats={stats} />
            </div>
          ) : (
            <div className="-mx-4 h-40 animate-pulse border-y border-border bg-surface sm:mx-0 sm:rounded-md sm:border" />
          )
        ) : !queue ? (
          <div className="-mx-4 h-40 animate-pulse border-y border-border bg-surface sm:mx-0 sm:rounded-md sm:border" />
        ) : tab === "log" ? (
          queue.log.length === 0 ? (
            <Empty>还没有处理记录。</Empty>
          ) : (
            <Section>
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
    <Section>
      <ul className="divide-y divide-border">
        {items.map((entry) => (
          <li key={entry.job.id}>
            <QueueCard item={entry} reports={entry.reports} onDone={onDone} />
          </li>
        ))}
      </ul>
    </Section>
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
  const [confirmBan, setConfirmBan] = useState(false);
  const run = (action: () => Promise<AdminResult>) => startTransition(async () => onDone(await action()));
  const button = "h-9 rounded-md border px-3 text-body disabled:opacity-40";

  return (
    <article className="py-4">
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
              <li key={r.id} className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
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

      <div className="mt-3 flex flex-wrap gap-2">
        {reports ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => dismissReports(job.id))}
            className={`${button} border-border`}
          >
            驳回举报
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveJob(job.id))}
            className={`${button} border-ok text-ok`}
          >
            没问题，通过
          </button>
        )}
        <button
          type="button"
          disabled={pending || job.status === "removed"}
          onClick={() => run(() => takeDownJob(job.id))}
          className={`${button} border-danger text-danger`}
        >
          下架
        </button>
        {/* Without the employer's record there is nobody to name or ban. */}
        {employer &&
          !employer.bannedAt &&
          (confirmBan ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => banJobEmployer(job.id))}
                autoFocus
                className={`${button} border-danger bg-danger text-white`}
              >
                确定封禁「{employer.name}」并下架全部职位
              </button>
              <button
                type="button"
                onClick={() => setConfirmBan(false)}
                className="h-9 px-2 text-body text-muted underline"
              >
                取消
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmBan(true)} className={`${button} border-border text-danger`}>
              封禁雇主
            </button>
          ))}
      </div>
    </article>
  );
}
