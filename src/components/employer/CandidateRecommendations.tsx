"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, MessageSquare } from "lucide-react";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { useMyJobs } from "@/components/employer/use-my-jobs";
import { useCandidateDirectory } from "@/components/seeker/hub-client";
import { useChat } from "@/components/seeker/chat-client";
import {
  candidateFacts,
  keyConcerns,
  rankCandidates,
  splitLowMatches,
  type CandidateMatch,
  type MatchFactor,
} from "@/lib/candidate-matching";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Section } from "@/components/ui/Section";
import { APP_CARD } from "@/components/employer/app-style";
import { Pay } from "@/components/ui/Pay";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { regionById } from "@/config/countries";
import type { Job } from "@/lib/types";

const STATUS: Record<MatchFactor["status"], { label: string; style: string }> = {
  matched: { label: "匹配", style: "text-ok bg-ok-soft" },
  partial: { label: "部分匹配", style: "text-warn bg-warn-soft" },
  mismatch: { label: "不匹配", style: "text-danger bg-danger-soft" },
  unknown: { label: "待确认", style: "text-muted bg-background" },
  not_required: { label: "职位未要求", style: "text-muted bg-background" },
};

export function CandidateRecommendations() {
  return (
    <EmployerGate next="/employer/candidates">{(me) => <Recommendations key={me.employerId} me={me} />}</EmployerGate>
  );
}

function Recommendations({ me }: { me: EmployerIdentity }) {
  const { ready } = useMyJobs(me.email);
  const { candidates } = useCandidateDirectory();
  const [jobId, setJobId] = useState("");
  const [query, setQuery] = useState("");
  const [minimum, setMinimum] = useState("0");
  if (!ready) return <SkeletonList count={3} label="加载招聘职位…" />;
  const jobs = ready.jobs.filter((job) => job.status === "active" && Date.parse(job.expiresAt) > ready.now);
  const job = jobs.find((item) => item.id === jobId) ?? jobs[0];
  const matches = job
    ? rankCandidates(candidates, job).filter(
        ({ candidate, score }) =>
          (!Number(minimum) || (score !== null && score >= Number(minimum))) &&
          `${candidate.name} ${candidate.headline} ${candidate.bio} ${candidate.resume.skills}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      )
    : [];
  return (
    <div className="space-y-section">
      <header>
        <p className="text-meta text-muted">雇主工作台 · {me.employerName}</p>
        <h1 className="mt-1 text-title font-semibold">推荐人才</h1>
        <p className="mt-1 text-body text-muted">演示候选资料 · 匹配分仅供参考，班次与实际经验需双方确认。</p>
      </header>
      {!job ? (
        <Section look="app">
          <div className="space-y-3 py-10 text-center">
            <h2 className="text-subtitle font-semibold">暂无招聘中的职位</h2>
            <ButtonLink href="/employer/post">发布招聘</ButtonLink>
            <p>
              <Link href="/employer/jobs" className="text-body text-brand underline">
                管理已有职位
              </Link>
            </p>
          </div>
        </Section>
      ) : (
        <>
          <section aria-label="推荐条件" className={`${APP_CARD} space-y-4`}>
            <Select
              name="job"
              label="招聘职位"
              required
              options={jobs.map((item) => ({
                value: item.id,
                label: `${item.titleZh} · ${regionById(item.country, item.regionId)?.nameZh ?? ""}`,
              }))}
              defaultValue={job.id}
              onChange={setJobId}
            />
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-body text-muted">
              <Pay pay={job.pay} country={job.country} />
              <span>{formatEmploymentTypes(job.employmentType)}</span>
              <span>
                {job.hoursPerWeek
                  ? `${job.hoursPerWeek.min}–${job.hoursPerWeek.max ?? job.hoursPerWeek.min} 小时 / 周`
                  : "工时待沟通"}
              </span>
              <Link href={`/jobs/${job.id}`} className="text-brand underline">
                查看职位要求
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <label className="block space-y-1 text-body">
                <span className="block text-meta text-muted">搜索求职者</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="姓名、技能或经验"
                  className="h-11 w-full rounded-control border border-border bg-surface px-3 focus:border-brand"
                />
              </label>
              <Select
                name="minimum"
                label="最低匹配分"
                required
                options={[
                  { value: "0", label: "全部" },
                  { value: "60", label: "60 分及以上" },
                  { value: "80", label: "80 分及以上" },
                ]}
                defaultValue={minimum}
                onChange={setMinimum}
              />
            </div>
          </section>
          <Section
            look="app"
            title={`推荐求职者 · ${matches.length} 人`}
            action={<span className="text-meta text-muted">匹配分从高到低</span>}
          >
            {!matches.length ? (
              <p role="status" className="py-12 text-center text-body text-muted">
                暂无符合条件的求职者
              </p>
            ) : (
              <MatchList key={job.id} matches={matches} job={job} />
            )}
          </Section>
        </>
      )}
    </div>
  );
}

/** The candidates, with low matches folded at the bottom (the user's choice: folded, not hidden). */
function MatchList({ matches, job }: { matches: CandidateMatch[]; job: Job }) {
  const [showLow, setShowLow] = useState(false);
  const { shown, low } = splitLowMatches(matches);
  const rows = (list: CandidateMatch[]) =>
    list.map((match) => (
      <li key={`${job.id}:${match.candidate.id}`}>
        <CandidateRow match={match} job={job} />
      </li>
    ));
  return (
    <>
      <ul className="divide-y divide-border">{rows(shown)}</ul>
      {low.length > 0 && (
        <section aria-label="匹配度较低的求职者">
          <button
            type="button"
            aria-expanded={showLow}
            aria-controls={`low-${job.id}`}
            onClick={() => setShowLow((v) => !v)}
            className="pressable-row -mx-4 flex min-h-11 w-[calc(100%+2rem)] items-center justify-between px-4 py-3 text-body text-muted lg:-mx-5 lg:w-[calc(100%+2.5rem)] lg:px-5"
          >
            另外 {low.length} 位匹配度较低
            {showLow ? (
              <ChevronUp aria-hidden="true" className="size-4" />
            ) : (
              <ChevronDown aria-hidden="true" className="size-4" />
            )}
          </button>
          {showLow && (
            <ul id={`low-${job.id}`} className="divide-y divide-border border-t border-border">
              {rows(low)}
            </ul>
          )}
        </section>
      )}
    </>
  );
}

function CandidateRow({ match, job }: { match: CandidateMatch; job: Job }) {
  const { candidate, factors, score, coverage } = match;
  const [expanded, setExpanded] = useState(false);
  const { openCandidateChat } = useChat();
  const [opening, setOpening] = useState(false);
  const router = useRouter();
  const concerns = keyConcerns(factors);
  return (
    <article>
      <div className="py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-subtitle font-semibold">{candidate.name}</h3>
              <span className="text-meta text-muted">{candidate.source === "demo" ? "演示简历" : "公开主页"}</span>
            </div>
            <p className="mt-1 break-words text-body">{candidate.headline || "求职意向待完善"}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-meta text-muted">匹配分</p>
            <p className="mt-1 leading-none text-brand">
              {score === null ? (
                <span className="text-subtitle font-semibold">待确认</span>
              ) : (
                <>
                  <span className="font-figure text-[1.875rem]">{score}</span>
                  <span className="ml-0.5 text-meta font-medium text-muted">/100</span>
                </>
              )}
            </p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-body">
          {candidateFacts(candidate).map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-muted">{fact.label}</dt>
              <dd className={`break-words ${fact.value === "待补充" ? "text-muted" : ""}`}>{fact.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 break-words text-meta text-muted">
          {concerns.length
            ? `需关注：${concerns.map((item) => `${item.label}${STATUS[item.status].label}`).join("、")}`
            : "已填写条件均匹配；具体班次需沟通"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls={`resume-${candidate.id}`}
            className="pressable inline-flex min-h-11 items-center gap-2 rounded-control border border-border px-3 text-body hover:border-muted"
          >
            <FileText aria-hidden="true" className="size-4" />
            {expanded ? "收起简历" : "简历与匹配分析"}
            {expanded ? (
              <ChevronUp aria-hidden="true" className="size-4" />
            ) : (
              <ChevronDown aria-hidden="true" className="size-4" />
            )}
          </button>
          <Button
            variant="secondary"
            loading={opening}
            onClick={async () => {
              setOpening(true);
              const id = await openCandidateChat(candidate, job);
              if (id) router.push(`/messages?conversation=${encodeURIComponent(id)}`);
              else setOpening(false);
            }}
          >
            <MessageSquare aria-hidden="true" className="size-4" />
            发起聊天
          </Button>
        </div>
      </div>
      {expanded && (
        <div id={`resume-${candidate.id}`} className="space-y-4 border-t border-dashed border-border pb-5 pt-4">
          <section aria-label="求职简历" className="space-y-2 text-body">
            <h4 className="font-semibold">求职简历</h4>
            <p className="break-words leading-relaxed">{candidate.bio || "个人介绍待补充"}</p>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-meta text-muted">技能</dt>
                <dd className="break-words">{candidate.resume.skills || "待补充"}</dd>
              </div>
              <div>
                <dt className="text-meta text-muted">求职意向</dt>
                <dd>{formatEmploymentTypes(candidate.resume.employmentTypes) || "待补充"}</dd>
              </div>
            </dl>
          </section>
          <section aria-label="匹配分析">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-body font-semibold">匹配分析</h4>
              <p className="text-meta text-muted">可核对资料覆盖 {coverage}%</p>
            </div>
            <p className="mt-2 text-meta text-muted">
              按技能、经验、语言、用工形式、地区、工时、薪资加权；资料缺失不计匹配分。
            </p>
            <ul className="mt-3 divide-y divide-border">
              {factors.map((item) => (
                <li key={item.key} className="py-3">
                  <div className="flex items-center justify-between gap-2 text-body">
                    <p className="font-medium">
                      {item.label}
                      <span className="ml-2 text-meta text-muted">
                        {item.status === "not_required" ? "不计分" : `${Math.round(item.earned)} / ${item.weight}`}
                      </span>
                    </p>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-meta ${STATUS[item.status].style}`}>
                      {STATUS[item.status].label}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-meta text-muted">职位：{item.requirement}</p>
                  <p className="mt-1 break-words text-body">{item.evidence}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </article>
  );
}
