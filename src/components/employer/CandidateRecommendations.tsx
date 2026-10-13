"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, MessageSquare, Users } from "lucide-react";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { useMyJobs } from "@/components/employer/use-my-jobs";
import { useCandidateDirectory } from "@/components/seeker/hub-client";
import { useChat } from "@/components/seeker/chat-client";
import { rankCandidates, type CandidateMatch, type MatchFactor } from "@/lib/candidate-matching";
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
  return <EmployerGate next="/employer/candidates">{(me) => <Recommendations key={me.employerId} me={me} />}</EmployerGate>;
}

function Recommendations({ me }: { me: EmployerIdentity }) {
  const { ready } = useMyJobs(me.email);
  const candidates = useCandidateDirectory();
  const [jobId, setJobId] = useState("");
  const [query, setQuery] = useState("");
  const [minimum, setMinimum] = useState("0");
  if (!ready) return <p role="status" className="py-12 text-muted">加载招聘职位…</p>;
  const jobs = ready.jobs.filter((job) => job.status === "active" && Date.parse(job.expiresAt) > ready.now);
  const job = jobs.find((item) => item.id === jobId) ?? jobs[0];
  const matches = job ? rankCandidates(candidates, job).filter(({ candidate, score }) =>
    (!Number(minimum) || (score !== null && score >= Number(minimum))) &&
    `${candidate.name} ${candidate.headline} ${candidate.bio} ${candidate.resume.skills}`.toLowerCase().includes(query.trim().toLowerCase())) : [];
  return <div className="space-y-5">
    <header><p className="text-xs font-medium text-brand">雇主工作台 · {me.employerName}</p><h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold"><Users aria-hidden="true" className="size-6 text-brand" />推荐人才</h1><p className="mt-2 text-sm text-muted">演示候选资料 · 匹配分仅供参考，班次与实际经验需双方确认。</p></header>
    {!job ? <section className="space-y-3 border-y border-border py-10 text-center"><h2 className="font-medium">暂无招聘中的职位</h2><Link href="/employer/post" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white">发布招聘</Link><p><Link href="/employer/jobs" className="text-sm text-brand underline">管理已有职位</Link></p></section> : <>
      <section aria-label="推荐条件" className="space-y-4 border-y border-border py-4">
        <label className="block text-sm font-medium">招聘职位<select className="mt-2 h-11 w-full rounded-lg border border-border bg-surface px-3" value={job.id} onChange={(event) => setJobId(event.target.value)}>{jobs.map((item) => <option key={item.id} value={item.id}>{item.titleZh} · {regionById(item.country, item.regionId)?.nameZh}</option>)}</select></label>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted"><span>{formatEmploymentTypes(job.employmentType)}</span><span>${job.pay.min}{job.pay.max ? `–${job.pay.max}` : ""} / 小时</span><span>{job.hoursPerWeek ? `${job.hoursPerWeek.min}–${job.hoursPerWeek.max ?? job.hoursPerWeek.min} 小时 / 周` : "工时待沟通"}</span><Link href={`/jobs/${job.id}`} className="text-brand underline">查看职位要求</Link></div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]"><label className="text-sm">搜索求职者<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="姓名、技能或经验" className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3" /></label><label className="text-sm">最低匹配分<select value={minimum} onChange={(event) => setMinimum(event.target.value)} className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3"><option value="0">全部</option><option value="60">60 分及以上</option><option value="80">80 分及以上</option></select></label></div>
      </section>
      <div className="flex items-center justify-between text-sm"><h2 className="font-medium">推荐求职者 · {matches.length} 人</h2><span className="text-muted">匹配分从高到低</span></div>
      {!matches.length ? <p role="status" className="border-y border-border py-12 text-center text-muted">暂无符合条件的求职者</p> : <ul className="space-y-3">{matches.map((match) => <li key={`${job.id}:${match.candidate.id}`}><CandidateRow match={match} job={job} /></li>)}</ul>}
    </>}
  </div>;
}

function CandidateRow({ match, job }: { match: CandidateMatch; job: Job }) {
  const { candidate, factors, score, coverage } = match;
  const [expanded, setExpanded] = useState(false);
  const { openCandidateChat } = useChat();
  const router = useRouter();
  const highlights = factors.filter((item) => item.status === "matched").slice(0, 3);
  const concerns = factors.filter((item) => ["unknown", "mismatch", "partial"].includes(item.status));
  return <article className="overflow-hidden rounded-lg border border-border bg-surface">
    <div className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold break-words">{candidate.name}</h3><span className="text-xs text-muted">{candidate.source === "demo" ? "演示简历" : "公开主页"}</span></div><p className="mt-1 break-words text-sm">{candidate.headline || "求职意向待完善"}</p><p className="mt-2 text-xs text-muted">{candidate.location || "地区待补充"} · {candidate.resume.experienceYears != null ? `${candidate.resume.experienceYears} 年经验` : "经验年数待确认"}</p></div><div className="shrink-0 text-right"><p className="text-xs text-muted">匹配分</p><p className="mt-1 text-2xl font-semibold text-brand">{score ?? "待确认"}{score !== null && <span className="ml-1 text-xs text-muted">/ 100</span>}</p></div></div>
      <div className="mt-3 flex flex-wrap gap-2">{highlights.map((item) => <span key={item.key} className="rounded px-2 py-1 text-xs text-ok bg-ok-soft">{item.label}匹配</span>)}</div>
      <p className="mt-3 break-words text-xs text-muted">{concerns.length ? `需关注：${concerns.map((item) => `${item.label}${STATUS[item.status].label}`).join("、")}` : "已填写条件均匹配；具体班次需沟通"}</p>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={`resume-${candidate.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm"><FileText aria-hidden="true" className="size-4" />{expanded ? "收起简历" : "简历与匹配分析"}{expanded ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}</button><button type="button" onClick={() => { const id = openCandidateChat(candidate, job); if (id) router.push(`/messages?conversation=${encodeURIComponent(id)}`); }} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-medium text-white"><MessageSquare aria-hidden="true" className="size-4" />发起聊天</button></div>
    </div>
    {expanded && <div id={`resume-${candidate.id}`} className="space-y-4 border-t border-border px-4 py-5 sm:px-5">
      <section aria-label="求职简历" className="space-y-2 text-sm"><h4 className="font-semibold">求职简历</h4><p className="break-words leading-relaxed">{candidate.bio || "个人介绍待补充"}</p><dl className="grid gap-2 sm:grid-cols-2"><div><dt className="text-xs text-muted">技能</dt><dd className="break-words">{candidate.resume.skills || "待补充"}</dd></div><div><dt className="text-xs text-muted">语言</dt><dd>{candidate.languages || "待补充"}</dd></div><div><dt className="text-xs text-muted">求职意向</dt><dd>{formatEmploymentTypes(candidate.resume.employmentTypes) || "待补充"}</dd></div><div><dt className="text-xs text-muted">可工作时间</dt><dd className="break-words">{candidate.availability || "待补充"}</dd></div></dl></section>
      <section aria-label="匹配分析"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">匹配分析</h4><p className="text-xs text-muted">可核对资料覆盖 {coverage}%</p></div><p className="mt-2 text-xs text-muted">按技能、经验、语言、用工形式、地区、工时、薪资加权；资料缺失不计匹配分。</p><ul className="mt-3 divide-y divide-border">{factors.map((item) => <li key={item.key} className="py-3"><div className="flex items-center justify-between gap-2 text-sm"><p className="font-medium">{item.label}<span className="ml-2 text-xs text-muted">{item.status === "not_required" ? "不计分" : `${Math.round(item.earned)} / ${item.weight}`}</span></p><span className={`shrink-0 rounded px-2 py-1 text-xs ${STATUS[item.status].style}`}>{STATUS[item.status].label}</span></div><p className="mt-2 break-words text-xs text-muted">职位：{item.requirement}</p><p className="mt-1 break-words text-sm">{item.evidence}</p></li>)}</ul></section>
    </div>}
  </article>;
}
