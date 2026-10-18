"use client";
import { useState, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import type { Employer, Job } from "@/lib/types";
import type { ChangeResult } from "@/app/[lang]/employer/actions";
import { jobPhase, type Phase } from "@/components/employer/job-status";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { ManagedJob, type JobChangeDone } from "@/components/employer/ManagedJob";
import { posterLabel } from "@/components/employer/job-poster";
import { PILL_TABS, TabList, TabPanel, pillTab } from "@/components/employer/Tabs";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { useMyJobs } from "@/components/employer/use-my-jobs";
import { NO_NUMBERS } from "@/components/employer/job-card";
import { APP_CARD, noticeClass } from "@/components/employer/app-style";
import { ButtonLink } from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { inputClass } from "@/components/ui/input-class";
import { SEARCH_FROM, searchJobs } from "@/components/employer/job-search";

type TabKey = "all" | Phase;

/** One tab per phase (#69): each job is under exactly one, so the counts add up to 全部. */
const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "active", label: "招聘中" },
  { key: "ending", label: "将截止" },
  { key: "pending_review", label: "审核中" },
  { key: "timed_out", label: "已截止" },
  { key: "closed", label: "已结束" },
  { key: "removed", label: "已下架" },
];

/** The tab named in the address (`?tab=ending` from a closing reminder), else 全部. */
function tabFrom(value: string | null): TabKey {
  return TABS.find((t) => t.key === value)?.key ?? "all";
}

const TAB_ID_BASE = "manage";

type Loaded = NonNullable<ReturnType<typeof useMyJobs>["ready"]>;
type Notice = { ok: boolean; text: string };

export function ManageJobs() {
  return <EmployerGate next="/employer/jobs">{(me) => <Manage me={me} />}</EmployerGate>;
}

function Manage({ me }: { me: EmployerIdentity }) {
  const asked = useSearchParams().get("tab");
  const { ready, reload } = useMyJobs(me.email, { withPosters: true });
  const { profile } = useEmployerProfile(me.email);
  const [tab, setTab] = useState<TabKey>(() => tabFrom(asked));
  const [notice, setNotice] = useState<Notice>();
  const [query, setQuery] = useState("");
  const noticeRef = useFocusOnChange<HTMLParagraphElement>(notice);
  const employer = profile ?? undefined;
  // #198: with many jobs, a search narrows every tab, and the tabs count what it kept.
  const searchable = (ready?.jobs.length ?? 0) >= SEARCH_FROM;
  const searched = ready && searchable ? { ...ready, jobs: searchJobs(ready.jobs, query) } : ready;

  const done: JobChangeDone = (result, okText) => {
    setNotice(noticeFor(result, okText));
    reload();
  };

  return (
    <div className="space-y-4">
      <ManageHeader name={employer?.name ?? me.employerName} employer={employer} />
      {searchable && (
        <input
          type="search"
          aria-label="搜索职位名称"
          placeholder="搜索职位名称"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputClass()} w-full sm:max-w-sm`}
        />
      )}
      <StatusTabs ready={searched} value={tab} onChange={setTab} />
      {employer?.bannedAt && (
        <p className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger">
          这个雇主账号已被停用，职位已全部下架，不能再发布。
        </p>
      )}
      {notice && <NoticeLine notice={notice} noticeRef={noticeRef} />}
      <TabPanel idBase={TAB_ID_BASE} value={tab}>
        <JobsInTab ready={searched} tab={tab} query={searchable ? query : ""} employer={employer} onDone={done} />
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
      className={PILL_TABS}
      tabClassName={pillTab}
    />
  );
}

/** How many jobs show under each status, as the employer sees them now. */
function countByStatus(ready?: Loaded): Map<string, number> {
  const counts = new Map<string, number>();
  for (const job of ready?.jobs ?? []) {
    const phase = jobPhase(job, ready!.now);
    counts.set(phase, (counts.get(phase) ?? 0) + 1);
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
    <p ref={noticeRef} tabIndex={-1} role="status" className={noticeClass(notice.ok)}>
      {notice.text}
    </p>
  );
}

function JobsInTab({
  ready,
  tab,
  query,
  employer,
  onDone,
}: {
  ready?: Loaded;
  tab: TabKey;
  /** The search the jobs were narrowed by (#198), "" without one. */
  query: string;
  employer?: Employer;
  onDone: JobChangeDone;
}) {
  if (!ready) return <SkeletonList count={3} label="正在加载职位" />;

  const shown = ready.jobs.filter((job: Job) => tab === "all" || jobPhase(job, ready.now) === tab);
  if (shown.length === 0) {
    return (
      <p className={`${APP_CARD} py-10 text-center text-body text-muted`}>
        {query.trim()
          ? `${ready.jobs.length === 0 ? "" : "这个状态下"}没有名称里有「${query.trim()}」的职位。`
          : ready.jobs.length === 0
            ? "还没有发布过职位。"
            : "这个状态下没有职位。"}
      </p>
    );
  }

  return (
    // Round 19: each job is a card of its own (16px corners, soft shadow), 12px apart.
    <ul className="space-y-3">
      {shown.map((job) => (
        <li key={job.id} className={APP_CARD}>
          <ManagedJob
            job={job}
            employer={employer}
            numbers={ready.numbers[job.id] ?? NO_NUMBERS}
            renewals={ready.renewals[job.id]}
            applications={ready.applications[job.id]}
            poster={posterLabel(ready.posters.posters[job.id], ready.posters.teamSize)}
            contactFrom={ready.posters.contactsFrom[job.id]}
            now={ready.now}
            onDone={onDone}
          />
        </li>
      ))}
    </ul>
  );
}
