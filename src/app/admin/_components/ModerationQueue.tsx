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
} from "@/app/admin/actions";
import { FindingItem } from "@/components/employer/FindingsPanel";
import { STATUS_LABELS } from "@/components/employer/job-status";
import { formatPay } from "@/components/seeker/format";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

type Tab = "flagged" | "reported" | "log";

const time = new Intl.DateTimeFormat("zh-CN", { timeZone: "Pacific/Auckland", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function ModerationQueue() {
  const [queue, setQueue] = useState<Queue>();
  const [tab, setTab] = useState<Tab>("flagged");
  const [result, setResult] = useState<AdminResult>();
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let live = true;
    getModerationQueue().then((q) => {
      if (live) setQueue(q);
    });
    return () => {
      live = false;
    };
  }, [version]);

  const done = (r: AdminResult) => {
    setResult(r);
    reload();
  };

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "flagged", label: "发布时被标记", count: queue?.flagged.length },
    { key: "reported", label: "被举报", count: queue?.reported.length },
    { key: "log", label: "操作记录", count: queue?.log.length },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">审核后台</h1>
      <div role="tablist" aria-label="审核队列" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`h-9 shrink-0 rounded-full px-3 text-sm ${tab === t.key ? "bg-brand text-white" : "border border-border bg-surface text-muted"}`}
          >
            {t.label} {t.count ?? ""}
          </button>
        ))}
      </div>

      {result && (
        <p role="status" className={`rounded-lg px-3 py-2 text-sm ${result.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
          {result.ok ? `已处理：${result.text}` : result.error_zh}
        </p>
      )}

      {!queue ? (
        <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
      ) : tab === "log" ? (
        queue.log.length === 0 ? (
          <Empty>还没有处理记录。</Empty>
        ) : (
          <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {queue.log.map((e) => (
              <li key={e.id} className="flex gap-3 px-4 py-3 text-sm">
                <time dateTime={e.at} className="w-24 shrink-0 text-muted">
                  {time.format(new Date(e.at))}
                </time>
                <span>
                  {e.text}
                  <span className="ml-1 text-xs text-muted">· 演示管理员</span>
                </span>
              </li>
            ))}
          </ol>
        )
      ) : (
        <ul className="space-y-3">
          {(tab === "flagged" ? queue.flagged : queue.reported).map((entry) => (
            <li key={entry.job.id}>
              <QueueCard item={entry} reports={"reports" in entry ? (entry.reports as Report[]) : undefined} onDone={done} />
            </li>
          ))}
          {(tab === "flagged" ? queue.flagged : queue.reported).length === 0 && (
            <Empty>{tab === "flagged" ? "没有待审核的职位。" : "没有待处理的举报。"}</Empty>
          )}
        </ul>
      )}
    </div>
  );
}

function Empty({ children }: { children: string }) {
  return <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

function QueueCard({ item, reports, onDone }: { item: QueueItem; reports?: Report[]; onDone: (r: AdminResult) => void }) {
  const { job, employer, findings } = item;
  const [pending, startTransition] = useTransition();
  const [confirmBan, setConfirmBan] = useState(false);
  const run = (action: () => Promise<AdminResult>) => startTransition(async () => onDone(await action()));
  const status = STATUS_LABELS[job.status];
  const button = "h-9 rounded-lg border px-3 text-sm disabled:opacity-40";

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold leading-snug">{job.titleZh}</h2>
          <p className="truncate text-xs text-muted">
            {job.titleEn} · {regionById(job.country, job.regionId)?.nameZh} · {formatPay(job.pay, job.country)} · {job.id}
          </p>
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${status.className}`}>{status.zh}</span>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span>{employer?.name ?? job.employerId}</span>
        {employer && <VerificationBadge verification={employer.verification} />}
        {employer?.bannedAt && <span className="rounded bg-danger-soft px-1.5 py-0.5 text-xs text-danger">已封禁</span>}
        <span className="text-xs text-muted">发布于 {time.format(new Date(job.postedAt))}</span>
      </p>
      <p className="mt-2 line-clamp-3 text-sm whitespace-pre-line text-muted">{job.descriptionZh}</p>

      {reports && (
        <div className="mt-3 space-y-1.5">
          <h3 className="text-sm font-medium">{reports.length} 条举报</h3>
          <ul className="space-y-1.5">
            {reports.map((r) => (
              <li key={r.id} className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
                <span className="font-medium">{REPORT_REASON_LABELS[r.reason].zh}</span>
                {r.note && <span>：{r.note}</span>}
                <span className="ml-1 text-xs opacity-70">{time.format(new Date(r.createdAt))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {findings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <h3 className="text-sm font-medium">规则检查</h3>
          {findings.map((f, i) => (
            <FindingItem key={i} finding={f} />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {reports ? (
          <button type="button" disabled={pending} onClick={() => run(() => dismissReports(job.id))} className={`${button} border-border`}>
            驳回举报
          </button>
        ) : (
          <button type="button" disabled={pending} onClick={() => run(() => approveJob(job.id))} className={`${button} border-ok text-ok`}>
            没问题，通过
          </button>
        )}
        <button type="button" disabled={pending || job.status === "removed"} onClick={() => run(() => takeDownJob(job.id))} className={`${button} border-danger text-danger`}>
          下架
        </button>
        {!employer?.bannedAt &&
          (confirmBan ? (
            <>
              <button type="button" disabled={pending} onClick={() => run(() => banJobEmployer(job.id))} className={`${button} border-danger bg-danger text-white`}>
                确定封禁「{employer?.name}」并下架全部职位
              </button>
              <button type="button" onClick={() => setConfirmBan(false)} className="h-9 px-2 text-sm text-muted underline">
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
