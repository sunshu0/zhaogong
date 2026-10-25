"use client";
import { useState, type RefObject } from "react";
import { useSearchParams } from "next/navigation";
import type { Employer, Job } from "@/lib/types";
import type { ChangeResult } from "@/app/[lang]/employer/actions";
import { jobPhase, type Phase } from "@/components/employer/job-status";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { ManagedJob, type JobChangeDone, type NoAnswer } from "@/components/employer/ManagedJob";
import { posterLabel } from "@/components/employer/job-poster";
import { PILL_TABS, TabList, TabPanel, pillTab } from "@/components/employer/Tabs";
import { useEmployerProfile } from "@/components/employer/use-employer";
import { useFocusOnChange } from "@/components/employer/use-focus-on-change";
import { useMyJobs } from "@/components/employer/use-my-jobs";
import { NO_NUMBERS } from "@/components/employer/job-card";
import { APP_SHEET, noticeClass } from "@/components/employer/app-style";
import { ButtonLink } from "@/components/ui/Button";
import { SkeletonList } from "@/components/ui/Skeleton";
import { LoadFailed } from "@/components/ui/LoadFailed";
import { employerCommonMessages } from "@/i18n/messages/employer-common";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { inputClass } from "@/components/ui/input-class";
import { SEARCH_FROM, searchJobs } from "@/components/employer/job-search";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang, type Lang } from "@/i18n/lang";
import { employerJobsMessages } from "@/i18n/messages/employer-jobs";

type TabKey = "all" | Phase;
type TabWord = keyof (typeof employerJobsMessages.zh)["manage"]["tabs"];

/** One tab per phase (#69): each job is under exactly one, so the counts add up to 全部. */
const TABS: { key: TabKey; word: TabWord }[] = [
  { key: "all", word: "all" },
  { key: "active", word: "active" },
  { key: "ending", word: "ending" },
  { key: "pending_review", word: "pendingReview" },
  { key: "timed_out", word: "timedOut" },
  { key: "closed", word: "closed" },
  { key: "removed", word: "removed" },
];

/** The tab named in the address (`?tab=ending` from a closing reminder), else 全部. */
function tabFrom(value: string | null): TabKey {
  return TABS.find((t) => t.key === value)?.key ?? "all";
}

const TAB_ID_BASE = "manage";

type Loaded = NonNullable<ReturnType<typeof useMyJobs>["ready"]>;
/** `title` is the job's own title, shown in its own element; an error from the server comes as text only. */
type Notice = { ok: boolean; title?: string; text: string };

export function ManageJobs() {
  return <EmployerGate next="/employer/jobs">{(me) => <Manage me={me} />}</EmployerGate>;
}

function Manage({ me }: { me: EmployerIdentity }) {
  const t = useMessages(employerJobsMessages);
  const names = useMessages(employerCommonMessages).load;
  const lang = useLang();
  const asked = useSearchParams().get("tab");
  const { ready, failed, reload } = useMyJobs(me.email, { withPosters: true });
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
    // #247: the list would get no answer either, and would take the place of the card that is still open.
    if (!("noAnswer" in result)) reload();
  };

  return (
    <div className="space-y-4">
      <ManageHeader name={employer?.name ?? me.employerName} employer={employer} lang={lang} />
      {searchable && (
        <input
          type="search"
          aria-label={t.manage.searchLabel}
          placeholder={t.manage.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={`${inputClass()} w-full sm:max-w-sm`}
        />
      )}
      <StatusTabs ready={searched} value={tab} onChange={setTab} />
      {employer?.bannedAt && (
        <p className="rounded-control bg-danger-soft px-3 py-2 text-body text-danger">{t.manage.banned}</p>
      )}
      {notice && <NoticeLine notice={notice} noticeRef={noticeRef} />}
      <TabPanel idBase={TAB_ID_BASE} value={tab}>
        {failed ? (
          <LoadFailed what={names.jobs} onRetry={reload} />
        ) : (
          <JobsInTab
            ready={searched}
            tab={tab}
            query={searchable ? query : ""}
            employer={employer}
            lang={lang}
            onDone={done}
          />
        )}
      </TabPanel>
    </div>
  );
}

function noticeFor(result: ChangeResult | NoAnswer, okText: string): Notice {
  // An error comes from the Server Function already worded (actions.ts): it is shown as it is.
  return result.ok ? { ok: true, title: result.job.titleZh, text: okText } : { ok: false, text: result.error_zh };
}

function ManageHeader({ name, employer, lang }: { name: string; employer?: Employer; lang: Lang }) {
  const t = useMessages(employerJobsMessages).manage;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
      <h1 className="text-title font-semibold">{t.heading}</h1>
      <span lang={contentLang(name)} className="text-body">
        {name}
      </span>
      {employer && <VerificationBadge verification={employer.verification} lang={lang} />}
      <ButtonLink href="/employer/post" className="ml-auto">
        {t.postNew}
      </ButtonLink>
    </div>
  );
}

function StatusTabs({ ready, value, onChange }: { ready?: Loaded; value: TabKey; onChange: (tab: TabKey) => void }) {
  const words = useMessages(employerJobsMessages).manage;
  const counts = countByStatus(ready);
  return (
    <TabList
      label={words.tabsLabel}
      idBase={TAB_ID_BASE}
      tabs={TABS.map((t) => ({ key: t.key, label: `${words.tabs[t.word]} ${tabCount(t.key, ready, counts)}` }))}
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
  const t = useMessages(employerJobsMessages).manage;
  return (
    <p ref={noticeRef} tabIndex={-1} role="status" className={noticeClass(notice.ok)}>
      {/* The job's title is the employer's own, so it says which language it is in (ADR 0023 §6). */}
      {notice.title != null && (
        <>
          <span lang={contentLang(notice.title)}>{notice.title}</span>
          {t.noticeSeparator}
        </>
      )}
      {notice.text}
    </p>
  );
}

function JobsInTab({
  ready,
  tab,
  query,
  employer,
  lang,
  onDone,
}: {
  ready?: Loaded;
  tab: TabKey;
  /** The search the jobs were narrowed by (#198), "" without one. */
  query: string;
  employer?: Employer;
  lang: Lang;
  onDone: JobChangeDone;
}) {
  const t = useMessages(employerJobsMessages).manage;
  if (!ready) return <SkeletonList count={3} label={t.loading} />;

  const shown = ready.jobs.filter((job: Job) => tab === "all" || jobPhase(job, ready.now) === tab);
  if (shown.length === 0) {
    return (
      <p className={`${APP_SHEET} py-10 text-center text-body text-muted`}>
        {query.trim()
          ? ready.jobs.length === 0
            ? t.noMatch(query.trim())
            : t.noMatchInTab(query.trim())
          : ready.jobs.length === 0
            ? t.noneYet
            : t.noneInTab}
      </p>
    );
  }

  return (
    // Visual A (ADR 0036): each job is a sheet of its own, 12px apart; it opens nothing as a whole.
    <ul className="space-y-3">
      {shown.map((job) => (
        <li key={job.id} className={APP_SHEET}>
          <ManagedJob
            job={job}
            employer={employer}
            numbers={ready.numbers[job.id] ?? NO_NUMBERS}
            renewals={ready.renewals[job.id]}
            applications={ready.applications[job.id]}
            poster={posterLabel(ready.posters.posters[job.id], ready.posters.teamSize, lang)}
            contactFrom={ready.posters.contactsFrom[job.id]}
            now={ready.now}
            onDone={onDone}
          />
        </li>
      ))}
    </ul>
  );
}
