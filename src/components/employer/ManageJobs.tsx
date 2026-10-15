"use client";
import Link from "next/link";
import { useMemo, useState, type RefObject } from "react";
import type { Employer, Job } from "@/lib/types";
import type { ChangeResult } from "@/app/employer/actions";
import { effectiveStatus, type ShownStatus } from "@/components/employer/job-status";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { ManagedJob, type JobChangeDone } from "@/components/employer/ManagedJob";
import { TabList, TabPanel } from "@/components/employer/Tabs";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { useMyJobs } from "@/components/employer/use-my-jobs";
import { chatPeopleByJob } from "@/components/employer/job-card";
import { useChat } from "@/components/seeker/chat-client";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";

type TabKey = "all" | ShownStatus;

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "active", label: "招聘中" },
  { key: "pending_review", label: "审核中" },
  { key: "expired", label: "已结束" },
  { key: "removed", label: "已下架" },
];

const TAB_ID_BASE = "manage";

type Loaded = NonNullable<ReturnType<typeof useMyJobs>["ready"]>;
type Notice = { ok: boolean; text: string };

export function ManageJobs() {
  return <EmployerGate next="/employer/jobs">{(me) => <Manage me={me} />}</EmployerGate>;
}

function Manage({ me }: { me: EmployerIdentity }) {
  const { ready, reload } = useMyJobs(me.email);
  const { profile } = useEmployerProfile(me.email);
  const [tab, setTab] = useState<TabKey>("all");
  const [notice, setNotice] = useState<Notice>();
  const noticeRef = useFocusOnChange<HTMLParagraphElement>(notice);
  const employer = profile ?? undefined;

  const done: JobChangeDone = (result, okText) => {
    setNotice(noticeFor(result, okText));
    reload();
  };

  return (
    <div className="space-y-4">
      <ManageHeader name={employer?.name ?? me.employerName} employer={employer} />
      <StatusTabs ready={ready} value={tab} onChange={setTab} />
      {employer?.bannedAt && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          这个雇主账号已被停用，职位已全部下架，不能再发布。
        </p>
      )}
      {notice && <NoticeLine notice={notice} noticeRef={noticeRef} />}
      <TabPanel idBase={TAB_ID_BASE} value={tab}>
        <JobsInTab ready={ready} tab={tab} employer={employer} email={me.email} onDone={done} />
      </TabPanel>
    </div>
  );
}

function noticeFor(result: ChangeResult, okText: string): Notice {
  return result.ok ? { ok: true, text: `${result.job.titleZh}：${okText}` } : { ok: false, text: result.error_zh };
}

function ManageHeader({ name, employer }: { name: string; employer?: Employer }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <h1 className="text-lg font-semibold">管理职位</h1>
      <span className="text-sm">{name}</span>
      {employer && <VerificationBadge verification={employer.verification} />}
      <Link href="/employer/post" className="ml-auto rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">
        发布新职位
      </Link>
    </div>
  );
}

function StatusTabs({ ready, value, onChange }: { ready?: Loaded; value: TabKey; onChange: (tab: TabKey) => void }) {
  const counts = countByStatus(ready);
  return (
    <TabList
      label="按状态"
      idBase={TAB_ID_BASE}
      tabs={TABS.map((t) => ({ key: t.key, label: `${t.label} ${tabCount(t.key, ready, counts)}` }))}
      value={value}
      onChange={onChange}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      tabClassName={(selected) =>
        `h-9 shrink-0 rounded-full px-3 text-sm ${selected ? "bg-brand text-white" : "border border-border bg-surface text-muted"}`
      }
    />
  );
}

/** How many jobs show under each status, as the employer sees them now. */
function countByStatus(ready?: Loaded): Map<string, number> {
  const counts = new Map<string, number>();
  for (const job of ready?.jobs ?? []) {
    const status = effectiveStatus(job, ready!.now);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return counts;
}

/** The number after a tab's name: all jobs for 全部 (blank while loading), else that status's count. */
function tabCount(key: TabKey, ready: Loaded | undefined, counts: Map<string, number>): number | string {
  if (key === "all") return ready?.jobs.length ?? "";
  return counts.get(key) ?? 0;
}

function NoticeLine({ notice, noticeRef }: { notice: Notice; noticeRef: RefObject<HTMLParagraphElement | null> }) {
  return (
    <p
      ref={noticeRef}
      tabIndex={-1}
      role="status"
      className={`rounded-lg px-3 py-2 text-sm outline-none ${notice.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}
    >
      {notice.text}
    </p>
  );
}

function JobsInTab({
  ready,
  tab,
  employer,
  email,
  onDone,
}: {
  ready?: Loaded;
  tab: TabKey;
  employer?: Employer;
  email: string;
  onDone: JobChangeDone;
}) {
  // Chats live in this browser (demo); a conversation started from a job keeps the job's id.
  const { conversations } = useChat();
  const chats = useMemo(() => chatPeopleByJob(conversations), [conversations]);
  if (!ready) return <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />;

  const shown = ready.jobs.filter((job: Job) => tab === "all" || effectiveStatus(job, ready.now) === tab);
  if (shown.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted">
        {ready.jobs.length === 0 ? "还没有发布过职位。" : "这个状态下没有职位。"}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {shown.map((job) => (
        <li key={job.id}>
          <ManagedJob
            job={job}
            employer={employer}
            email={email}
            views={ready.views[job.id] ?? 0}
            chats={chats[job.id] ?? 0}
            now={ready.now}
            onDone={onDone}
          />
        </li>
      ))}
    </ul>
  );
}
