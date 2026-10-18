"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  decideMyApplicant,
  getMyJobApplicants,
  markMyApplicantsSeen,
  type Applicant,
} from "@/app/[lang]/employer/applicant-actions";
import type { Job } from "@/lib/types";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { DECISION_LABELS, type ApplicationDecision } from "@/components/seeker/applications";
import { useChat } from "@/components/seeker/chat-client";
import { Section } from "@/components/ui/Section";
import { BACK_LINK } from "@/components/employer/app-style";
import { toast } from "@/components/ui/Toast";
import { Tag } from "@/components/ui/Tag";
import { buttonClass } from "@/components/ui/Button";
import { InterviewInvite } from "@/components/employer/InterviewInvite";
import type { InterviewView } from "@/components/seeker/interviews";
import { SkeletonList } from "@/components/ui/Skeleton";
import { PILL_TABS, TabList, TabPanel, pillTab } from "@/components/employer/Tabs";
import {
  APPLICANT_FILTERS,
  applicantFilterCounts,
  filterApplicants,
  type ApplicantFilter,
} from "@/components/employer/applicant-filter";

const FILTER_ID_BASE = "applicant-filter";

const appliedAt = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Pacific/Auckland",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * 申请人 (#84, R-35): who applied for one of the business's jobs, oldest first, each with the five facts, the note
 * and 合适 / 不合适 / 已录用 (#105), a chat with them, and 约面试 (#103). Once shown, everyone in it counts as seen. No
 * contact details: those follow the job's two rules (ADR 0002). Pills above the list show one kind at a time (#192).
 */
export function JobApplicants({ jobId }: { jobId: string }) {
  return (
    <EmployerGate next={`/employer/jobs/${jobId}/applicants`}>{(me) => <List jobId={jobId} me={me} />}</EmployerGate>
  );
}

function List({ jobId, me }: { jobId: string; me: EmployerIdentity }) {
  const [loaded, setLoaded] = useState<{ email: string; data: { job: Job; applicants: Applicant[] } | null }>();
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ApplicantFilter>("all");

  useEffect(() => {
    let live = true;
    getMyJobApplicants(jobId).then((data) => {
      if (!live) return;
      setLoaded({ email: me.email, data });
      // Shown with 新 marked; from now on they count as seen.
      if (data?.applicants.some((a) => a.isNew)) void markMyApplicantsSeen(jobId).catch(() => {});
    });
    return () => {
      live = false;
    };
  }, [jobId, me.email]);

  if (loaded?.email !== me.email) return <SkeletonList count={2} />;
  if (!loaded.data) {
    return (
      <div className="rounded-card bg-surface px-4 py-8 shadow-card text-center text-body text-muted">
        找不到这个职位，或者它不属于你登录的店铺。
        <Link href="/employer/jobs" className="mt-3 block text-brand underline">
          回到职位管理
        </Link>
      </div>
    );
  }

  const { job, applicants } = loaded.data;

  function setInterview(id: string, interview: InterviewView) {
    setLoaded((current) =>
      current?.data
        ? {
            ...current,
            data: {
              ...current.data,
              applicants: current.data.applicants.map((a) => (a.id === id ? { ...a, interview } : a)),
            },
          }
        : current,
    );
  }

  async function decide(id: string, decision: ApplicationDecision | null) {
    setError("");
    const ok = await decideMyApplicant(id, decision).catch(() => false);
    if (!ok) return setError("没有保存，请再试一次。");
    toast(decision ? `已标记「${DECISION_LABELS[decision]}」` : "已取消标记");
    setLoaded((current) =>
      current?.data
        ? {
            ...current,
            data: {
              ...current.data,
              applicants: current.data.applicants.map((a) => (a.id === id ? { ...a, decision } : a)),
            },
          }
        : current,
    );
  }

  return (
    <div className="space-y-section">
      <div>
        <Link href="/employer/jobs" className={BACK_LINK}>
          ← 职位管理
        </Link>
        <h1 className="mt-1 text-title font-semibold">申请人</h1>
        <p className="text-body text-muted">
          {job.titleZh} · {applicants.length} 个申请
        </p>
        <p className="mt-1 text-meta text-muted">
          申请里没有对方的联系方式。标「不合适」时，对方只会看到「雇主已看过」。标「已录用」时对方会收到通知；职位结束后，没被录用的人会收到「职位已结束」。
        </p>
      </div>

      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}

      {applicants.length === 0 ? (
        <Section look="app">
          <p className="py-group text-center text-body text-muted">还没有人申请这个职位。</p>
        </Section>
      ) : (
        <div className="space-y-3">
          <ApplicantFilterTabs applicants={applicants} value={filter} onChange={setFilter} />
          <TabPanel idBase={FILTER_ID_BASE} value={filter}>
            {filterApplicants(applicants, filter).length === 0 ? (
              <Section look="app">
                <p className="py-group text-center text-body text-muted">这一类还没有人。</p>
              </Section>
            ) : (
              <ul aria-label="申请人列表" className="space-y-3">
                {filterApplicants(applicants, filter).map((a) => (
                  <li key={a.id}>
                    <ApplicantCard
                      applicant={a}
                      job={job}
                      onDecide={(d) => void decide(a.id, d)}
                      onInterview={(interview) => setInterview(a.id, interview)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </TabPanel>
        </div>
      )}
    </div>
  );
}

/** 全部 / 未处理 / 合适 / 已录用 / 不合适, each with how many (#192); the same pills as 职位管理's statuses. */
function ApplicantFilterTabs({
  applicants,
  value,
  onChange,
}: {
  applicants: Applicant[];
  value: ApplicantFilter;
  onChange: (filter: ApplicantFilter) => void;
}) {
  const counts = applicantFilterCounts(applicants);
  return (
    <TabList
      label="按处理状态"
      idBase={FILTER_ID_BASE}
      tabs={APPLICANT_FILTERS.map((f) => ({ key: f.key, label: `${f.label} ${counts[f.key]}` }))}
      value={value}
      onChange={onChange}
      className={PILL_TABS}
      tabClassName={pillTab}
    />
  );
}

function ApplicantCard({
  applicant: a,
  job,
  onDecide,
  onInterview,
}: {
  applicant: Applicant;
  job: Job;
  onDecide: (decision: ApplicationDecision | null) => void;
  onInterview: (interview: InterviewView) => void;
}) {
  const router = useRouter();
  const { openApplicantChat } = useChat();
  const [opening, setOpening] = useState(false);
  return (
    <article aria-label={`申请人 ${a.profile.name}`} className="rounded-card bg-surface p-4 shadow-card lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-subtitle font-semibold">
            {a.profile.name}
            {a.isNew && <Tag kind="urgent">新</Tag>}
            {a.decision && <Tag kind={a.decision === "unfit" ? "neutral" : "perk"}>{DECISION_LABELS[a.decision]}</Tag>}
          </h2>
          {a.profile.headline && <p className="text-body text-muted">{a.profile.headline}</p>}
        </div>
        <p className="text-meta text-muted">{appliedAt.format(new Date(a.appliedAt))} 申请</p>
      </div>

      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-body">
        {a.facts.map((f) => (
          <div key={f.label} className="contents">
            <dt className="text-muted">{f.label}</dt>
            <dd className={f.value === "待补充" ? "text-muted" : ""}>{f.value}</dd>
          </div>
        ))}
      </dl>
      {a.note && <p className="mt-3 rounded-control bg-background px-3 py-2 text-body">附言：{a.note}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={buttonClass("primary")}
          disabled={opening}
          onClick={async () => {
            // The conversation is the one the job seeker has too (#110); its id comes from the server.
            setOpening(true);
            const id = await openApplicantChat({ id: a.id }, job);
            if (id) router.push(`/messages?conversation=${encodeURIComponent(id)}`);
            else setOpening(false);
          }}
        >
          发起聊天
        </button>
        <div role="group" aria-label={`标记 ${a.profile.name}`} className="flex gap-2">
          {(["fit", "unfit", "hired"] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={a.decision === d}
              onClick={() => onDecide(a.decision === d ? null : d)}
              className={`${buttonClass("secondary")} ${a.decision === d ? "bg-brand-soft" : ""}`}
            >
              {DECISION_LABELS[d]}
            </button>
          ))}
        </div>
      </div>
      <InterviewInvite applicationId={a.id} name={a.profile.name} interview={a.interview} onChange={onInterview} />
    </article>
  );
}
