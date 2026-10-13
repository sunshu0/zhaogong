"use client";

import Link from "next/link";
import { Building2, MapPin, MessageSquare, ShieldCheck, BriefcaseBusiness } from "lucide-react";
import { COUNTRIES, regionById } from "@/config/countries";
import { INDUSTRY_LABELS } from "@/i18n/labels";
import { usePublicEmployerProfile } from "@/components/seeker/hub-client";
import { useSession } from "@/components/seeker/session-client";
import { VerificationBadge } from "@/components/seeker/VerificationBadge";
import { verificationNote } from "@/components/seeker/job-facts";
import { JobCard } from "@/components/seeker/JobCard";
import { StartEmployerChat } from "@/components/seeker/StartEmployerChat";
import { EmployerActivitySummary } from "@/components/seeker/ChatActivity";
import { EmployerAvatar } from "@/components/seeker/ProfileAvatar";
import type { Employer, Job } from "@/lib/types";

export function EmployerPublicPage({ employer, jobs, now }: { employer: Employer; jobs: Job[]; now: number }) {
  const profile = usePublicEmployerProfile(employer.id);
  const session = useSession();
  const name = profile?.name.trim() || employer.name;
  const industries = [...new Set(jobs.map((job) => INDUSTRY_LABELS[job.industry].zh))];
  const isOwnEmployer = session?.activeRole === "employer" && session.employerId === employer.id;
  return <div className="space-y-6">
    <Link href="/jobs" className="inline-flex min-h-11 items-center text-sm text-brand">← 找工作</Link>
    <header className="border-b border-border pb-6">
      <div className="flex items-start gap-4"><EmployerAvatar employerId={employer.id} fallback={name} large /><div className="min-w-0 flex-1"><p className="text-xs text-muted">雇主主页 · 演示企业 · ID：{employer.id}</p><h1 className="mt-1 break-words text-2xl font-semibold">{name}</h1><div className="mt-2 flex flex-wrap items-center gap-3 text-sm"><VerificationBadge verification={employer.verification} /><span className="inline-flex items-center gap-1 text-muted"><MapPin aria-hidden="true" className="size-4 shrink-0" />{regionById("NZ", employer.regionId)?.nameZh ?? "地区待补充"}</span>{industries.length > 0 && <span className="text-muted">{industries.join(" / ")}</span>}</div></div></div>
      {profile?.headline && <p className="mt-4 break-words text-sm">{profile.headline}</p>}
      <EmployerActivitySummary employerId={employer.id} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {jobs.length > 0 ? <a href="#company-jobs" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white"><MessageSquare aria-hidden="true" className="size-4" />选择岗位并沟通<span className="text-xs">{jobs.length}</span></a> : <span className="inline-flex min-h-11 items-center text-sm text-muted">暂无在招岗位</span>}
        <a href="#company-credentials" className="inline-flex min-h-11 items-center text-sm text-brand underline">查看公司资质</a>
        {isOwnEmployer && <Link href="/profile" className="inline-flex min-h-11 items-center text-sm text-brand underline">编辑企业主页</Link>}
      </div>
    </header>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section aria-labelledby="company-about" className="space-y-4"><h2 id="company-about" className="flex items-center gap-2 text-lg font-semibold"><Building2 aria-hidden="true" className="size-5 text-brand" />企业介绍</h2><p className="whitespace-pre-line break-words text-sm leading-relaxed">{profile?.bio || "雇主尚未填写企业介绍。"}</p><dl className="grid gap-4 border-y border-border py-4 text-sm sm:grid-cols-2"><Info term="工作地址" value={profile?.location} /><Info term="招聘联系人" value={profile?.contactName} /><Info term="沟通语言" value={profile?.languages} /><Info term="联系时间" value={profile?.availability} /></dl></section>
      <section id="company-credentials" aria-labelledby="company-credentials-title" className="scroll-mt-20 space-y-3 border-l border-border pl-4"><h2 id="company-credentials-title" className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck aria-hidden="true" className="size-5 text-brand" />公司资质</h2><VerificationBadge verification={employer.verification} /><p className="text-sm leading-relaxed">{verificationNote(employer.verification, "NZ")}</p><dl className="space-y-3 text-sm"><Info term="登记名称" value={employer.legalName} /><Info term={COUNTRIES.NZ.businessNumberLabel} value={employer.businessNumber} /><Info term="认证雇主" value={employer.verification === "accredited_employer" ? "已认证（演示）" : "未提供认证信息"} /></dl><p className="text-xs leading-relaxed text-muted">演示登记与资质数据；企业验证不代表对工作条件的担保。</p>{isOwnEmployer && <Link href="/employer/verify" className="inline-flex min-h-11 items-center text-sm text-brand underline">管理企业验证</Link>}</section>
    </div>
    <section id="company-jobs" aria-labelledby="company-jobs-title" className="scroll-mt-20 border-t border-border pt-6"><h2 id="company-jobs-title" className="flex items-center gap-2 text-lg font-semibold"><BriefcaseBusiness aria-hidden="true" className="size-5 text-brand" />在招岗位 <span className="text-sm font-normal text-muted">{jobs.length} 个</span></h2>{jobs.length ? <ul className="mt-4 grid grid-cols-1 items-stretch gap-4">{jobs.map((job) => <li key={job.id} className="flex min-w-0 flex-col gap-2"><div className="flex-1"><JobCard job={job} employer={{ ...employer, name }} now={now} /></div><div className="flex items-center justify-between gap-2"><Link href={`/jobs/${job.id}`} className="inline-flex min-h-11 items-center text-sm text-brand underline">查看岗位详情</Link><StartEmployerChat employer={employer} job={job} /></div></li>)}</ul> : <p className="py-10 text-sm text-muted">该雇主暂时没有招聘中的职位。</p>}</section>
  </div>;
}

function Info({ term, value }: { term: string; value?: string }) {
  return <div><dt className="text-xs text-muted">{term}</dt><dd className="mt-1 break-words">{value?.trim() || "未填写"}</dd></div>;
}
