"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { regionById } from "@/config/countries";
import type { Employer, Job } from "@/lib/types";
import { closeMyJob, confirmHires, refreshMyJob, type ChangeResult } from "@/app/employer/actions";
import { canClose, canEdit, effectiveStatus, expiryLabelZh, refreshState, STATUS_LABELS, type ShownStatus } from "@/components/employer/job-status";
import { signOutEmployer, useEmployerSession } from "@/components/employer/session";
import { ShareTexts } from "@/components/employer/ShareTexts";
import { hiresLabelZh, type HiresAnswer } from "@/components/employer/hires";
import { HiresQuestion } from "@/components/employer/HiresQuestion";
import { SignInPanel } from "@/components/employer/SignInPanel";
import { TabList, TabPanel } from "@/components/employer/Tabs";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { useMyJobs } from "@/components/employer/use-my-jobs";
import { formatPay } from "@/components/seeker/format";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

const TABS: { key: "all" | ShownStatus; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "active", label: "招聘中" },
  { key: "pending_review", label: "审核中" },
  { key: "expired", label: "已结束" },
  { key: "removed", label: "已下架" },
];

export function ManageJobs({ accounts }: { accounts: Employer[] }) {
  const session = useEmployerSession();
  const { ready, reload } = useMyJobs(session?.employerId);
  const { profile } = useEmployerProfile(session?.employerId);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [notice, setNotice] = useState<{ ok: boolean; text: string }>();
  const noticeRef = useFocusOnChange<HTMLParagraphElement>(notice);

  if (session === undefined) return <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />;
  if (!session?.employerId) return <SignInPanel accounts={accounts} intro="登录后管理你发布的职位。" />;

  const employer = profile ?? accounts.find((a) => a.id === session.employerId);
  const counts = new Map<string, number>();
  for (const job of ready?.jobs ?? []) {
    const s = effectiveStatus(job, ready!.now);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  const shown = (ready?.jobs ?? []).filter((j) => tab === "all" || effectiveStatus(j, ready!.now) === tab);

  function done(result: ChangeResult, okText: string) {
    setNotice(result.ok ? { ok: true, text: `${result.job.titleZh}：${okText}` } : { ok: false, text: result.error_zh });
    reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <h1 className="text-lg font-semibold">管理职位</h1>
        <span className="text-sm">{employer?.name}</span>
        {employer && <VerificationBadge verification={employer.verification} />}
        <button type="button" onClick={signOutEmployer} className="text-sm text-muted underline">
          退出
        </button>
        <Link href="/employer/post" className="ml-auto rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">
          发布新职位
        </Link>
      </div>

      <TabList
        label="按状态"
        idBase="manage"
        tabs={TABS.map((t) => ({ key: t.key, label: `${t.label} ${t.key === "all" ? (ready?.jobs.length ?? "") : (counts.get(t.key) ?? 0)}` }))}
        value={tab}
        onChange={setTab}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        tabClassName={(selected) => `h-9 shrink-0 rounded-full px-3 text-sm ${selected ? "bg-brand text-white" : "border border-border bg-surface text-muted"}`}
      />

      {employer?.bannedAt && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">这个雇主账号已被停用，职位已全部下架，不能再发布。</p>}

      {notice && (
        <p ref={noticeRef} tabIndex={-1} role="status" className={`rounded-lg px-3 py-2 text-sm outline-none ${notice.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
          {notice.text}
        </p>
      )}

      <TabPanel idBase="manage" value={tab}>
      {!ready ? (
        <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">
          {ready.jobs.length === 0 ? "还没有发布过职位。" : "这个状态下没有职位。"}
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((job) => (
            <li key={job.id}>
              <ManagedJob
                job={job}
                employer={employer}
                employerId={session.employerId!}
                views={ready.views[job.id] ?? 0}
                now={ready.now}
                onDone={done}
              />
            </li>
          ))}
        </ul>
      )}
      </TabPanel>
    </div>
  );
}

function ManagedJob({
  job,
  employer,
  employerId,
  views,
  now,
  onDone,
}: {
  job: Job;
  employer?: Employer;
  employerId: string;
  views: number;
  now: number;
  onDone: (result: ChangeResult, okText: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<"close" | "hires">();
  const [sharing, setSharing] = useState(false);
  const status = effectiveStatus(job, now);
  const label = STATUS_LABELS[status];
  const refresh = refreshState(job, now);
  const button = "h-9 rounded-lg border border-border px-3 text-sm disabled:opacity-40";

  const run = (action: () => Promise<ChangeResult>, okText: string) =>
    startTransition(async () => {
      onDone(await action(), okText);
      setAsking(undefined);
    });

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold leading-snug">{job.titleZh}</h2>
          <p className="truncate text-xs text-muted">
            {job.titleEn} · {regionById(job.country, job.regionId)?.nameZh}
          </p>
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs ${label.className}`}>{label.zh}</span>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        <span className="font-medium text-brand">{formatPay(job.pay, job.country)}</span>
        <span className="text-muted">{expiryLabelZh(job, now)}</span>
        <span className="text-muted">{views} 人查看了联系方式</span>
        {hiresLabelZh(job) && <span className="font-medium text-ok">{hiresLabelZh(job)}</span>}
      </p>

      {status === "removed" && <p className="mt-2 text-sm text-danger">这个职位已被后台下架。如有疑问请联系我们。</p>}
      {status === "pending_review" && <p className="mt-2 text-sm text-warn">审核通过后才会公开。</p>}

      {canEdit(job) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/employer/jobs/${job.id}`} className={`${button} inline-flex items-center`}>
            编辑
          </Link>
          <button
            type="button"
            disabled={!refresh.allowed || pending}
            title={refresh.reason_zh}
            onClick={() => run(() => refreshMyJob(job.id, employerId), status === "expired" ? "已重新开放 30 天" : "已刷新，排到前面")}
            className={button}
          >
            {status === "expired" ? "重新开放" : refresh.allowed ? "刷新" : (refresh.reason_zh ?? "刷新")}
          </button>
          {canClose(job, now) && !asking && (
            <button type="button" onClick={() => setAsking("close")} className={button}>
              结束招聘
            </button>
          )}
          {status === "expired" && !asking && (
            <button type="button" onClick={() => setAsking("hires")} className={button}>
              {job.hiresConfirmed == null ? "记录招到几人" : "更正招到人数"}
            </button>
          )}
          {status === "active" && (
            <>
              <button type="button" aria-expanded={sharing} onClick={() => setSharing((s) => !s)} className={button}>
                {sharing ? "收起文案" : "复制文案"}
              </button>
              <Link href={`/jobs/${job.id}`} className="inline-flex h-9 items-center px-1 text-sm text-brand underline">
                查看
              </Link>
            </>
          )}
        </div>
      )}
      {asking === "close" && (
        <HiresQuestion
          optional
          submitLabel="确定结束招聘"
          submitClassName={`${button} border-danger text-danger`}
          pending={pending}
          onSubmit={(answer) => run(() => closeMyJob(job.id, employerId, answer), `已结束招聘${answer ? `，${answerText(answer)}` : ""}`)}
          onCancel={() => setAsking(undefined)}
        />
      )}
      {asking === "hires" && (
        <HiresQuestion
          initial={job.hiresConfirmed}
          optional={false}
          submitLabel="保存"
          submitClassName={`${button} border-brand text-brand`}
          pending={pending}
          onSubmit={(answer) => answer && run(() => confirmHires(job.id, employerId, answer), `已记录，${answerText(answer)}`)}
          onCancel={() => setAsking(undefined)}
        />
      )}
      {sharing && status === "active" && (
        <div className="mt-3">
          <ShareTexts job={job} employer={employer} />
        </div>
      )}
    </article>
  );
}

const answerText = (answer: HiresAnswer) => hiresLabelZh({ hiresConfirmed: answer.hired ? answer.count : 0 })!;
