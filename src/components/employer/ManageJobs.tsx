"use client";
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
import { ButtonLink } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { VerificationBadge } from "@/components/ui/VerificationBadge";

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
        <p className="rounded-md bg-danger-soft px-3 py-2 text-body text-danger">
          这个雇主账号已被停用，职位已全部下架，不能再发布。
        </p>
      )}
      {notice && <NoticeLine notice={notice} noticeRef={noticeRef} />}
      <TabPanel idBase={TAB_ID_BASE} value={tab}>
        <JobsInTab ready={ready} tab={tab} employer={employer} onDone={done} />
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
      <h1 className="text-title font-semibold">职位管理</h1>
      <span className="text-body">{name}</span>
      {employer && <VerificationBadge verification={employer.verification} />}
      <ButtonLink href="/employer/post" className="ml-auto">
        发布新职位
      </ButtonLink>
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
      className={STATUS_TABS}
      tabClassName={statusTab}
    />
  );
}

/** Round 13 tabs: plain text over a thin line, the chosen one in brand colour and underlined (like the bottom nav). */
export const STATUS_TABS = "-mx-4 flex gap-4 overflow-x-auto border-b border-border px-4";
export const statusTab = (selected: boolean) =>
  `-mb-px h-11 shrink-0 border-b-2 text-body ${selected ? "border-brand font-semibold text-brand" : "border-transparent text-muted"}`;

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
      className={`rounded-md px-3 py-2 text-body outline-none ${notice.ok ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}
    >
      {notice.text}
    </p>
  );
}

function JobsInTab({
  ready,
  tab,
  employer,
  onDone,
}: {
  ready?: Loaded;
  tab: TabKey;
  employer?: Employer;
  onDone: JobChangeDone;
}) {
  // Chats live in this browser (demo); a conversation started from a job keeps the job's id.
  const { conversations } = useChat();
  const chats = useMemo(() => chatPeopleByJob(conversations), [conversations]);
  if (!ready)
    return (
      <div className="-mx-4 h-40 animate-pulse border-y border-border bg-surface sm:mx-0 sm:rounded-md sm:border" />
    );

  const shown = ready.jobs.filter((job: Job) => tab === "all" || effectiveStatus(job, ready.now) === tab);
  if (shown.length === 0) {
    return (
      <Section>
        <p className="py-8 text-center text-body text-muted">
          {ready.jobs.length === 0 ? "还没有发布过职位。" : "这个状态下没有职位。"}
        </p>
      </Section>
    );
  }

  return (
    <Section>
      <ul className="divide-y divide-border">
        {shown.map((job) => (
          <li key={job.id}>
            <ManagedJob
              job={job}
              employer={employer}
              views={ready.views[job.id] ?? 0}
              chats={chats[job.id] ?? 0}
              now={ready.now}
              onDone={onDone}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
