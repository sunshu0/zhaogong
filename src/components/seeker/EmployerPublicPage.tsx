"use client";

import Link from "next/link";
import { Building2, MapPin, MessageSquare, ShieldCheck, BriefcaseBusiness } from "lucide-react";
import { COUNTRIES, regionById } from "@/config/countries";
import { INDUSTRY_LABELS } from "@/i18n/labels";
import { usePublicEmployerProfile } from "@/components/seeker/hub-client";
import { useSession } from "@/components/seeker/session-client";
import { VerificationBadge } from "@/components/ui/VerificationBadge";
import { verificationNote } from "@/components/seeker/job-facts";
import { JobCard } from "@/components/seeker/JobCard";
import { StartEmployerChat } from "@/components/seeker/StartEmployerChat";
import { EmployerActivitySummary } from "@/components/seeker/ChatActivity";
import { EmployerAvatar } from "@/components/seeker/ProfileAvatar";
import { buttonClass } from "@/components/ui/Button";
import type { Employer, Job } from "@/lib/types";

export function EmployerPublicPage({ employer, jobs }: { employer: Employer; jobs: Job[] }) {
  const profile = usePublicEmployerProfile(employer.id);
  const session = useSession();
  const name = profile?.name.trim() || employer.name;
  const industries = [...new Set(jobs.map((job) => INDUSTRY_LABELS[job.industry].zh))];
  const isOwnEmployer = session?.activeRole === "employer" && session.employerId === employer.id;
  // Round 19: the page wears the sample's type and cards — a header card, the introduction and the credentials as
  // cards side by side from 1024 px, and the jobs as the job list's cards.
  return (
    <div className="type-app space-y-3">
      <Link href="/jobs" className="pressable inline-flex min-h-11 items-center text-meta text-brand">
        ← 找工作
      </Link>
      <header className={CARD}>
        <div className="flex items-start gap-4">
          <EmployerAvatar employerId={employer.id} fallback={name} large />
          <div className="min-w-0 flex-1">
            <p className="text-meta text-muted">雇主主页 · 演示企业 · ID：{employer.id}</p>
            <h1 className="mt-1 text-title font-semibold break-words">{name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body">
              <VerificationBadge verification={employer.verification} />
              <span className="inline-flex items-center gap-1 text-muted">
                <MapPin aria-hidden="true" className="size-4 shrink-0" />
                {regionById("NZ", employer.regionId)?.nameZh ?? "地区待补充"}
              </span>
              {industries.length > 0 && <span className="text-muted">{industries.join(" / ")}</span>}
            </div>
          </div>
        </div>
        {profile?.headline && <p className="mt-4 text-body break-words">{profile.headline}</p>}
        <EmployerActivitySummary employerId={employer.id} />
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {jobs.length > 0 ? (
            <a href="#company-jobs" className={`${buttonClass("primary", { size: "lg" })} font-semibold`}>
              <MessageSquare aria-hidden="true" className="size-4" />
              选择岗位并沟通<span className="text-meta">{jobs.length}</span>
            </a>
          ) : (
            <span className="inline-flex min-h-11 items-center text-body text-muted">暂无在招岗位</span>
          )}
          <a href="#company-credentials" className="pressable inline-flex min-h-11 items-center text-body text-brand">
            查看公司资质
          </a>
          {isOwnEmployer && (
            <Link href="/profile" className="pressable inline-flex min-h-11 items-center text-body text-brand">
              编辑企业主页
            </Link>
          )}
        </div>
      </header>
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="company-about" className={`space-y-3 ${CARD}`}>
          <h2 id="company-about" className="flex items-center gap-2 text-subtitle font-semibold">
            <Building2 aria-hidden="true" className="size-5 text-brand" />
            企业介绍
          </h2>
          <p className="text-body leading-relaxed break-words whitespace-pre-line">
            {profile?.bio || "雇主尚未填写企业介绍。"}
          </p>
          <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <Info term="工作地址" value={profile?.location} />
            <Info term="招聘联系人" value={profile?.contactName} />
            <Info term="沟通语言" value={profile?.languages} />
            <Info term="联系时间" value={profile?.availability} />
          </dl>
        </section>
        <section
          id="company-credentials"
          aria-labelledby="company-credentials-title"
          className={`scroll-mt-20 space-y-3 ${CARD}`}
        >
          <h2 id="company-credentials-title" className="flex items-center gap-2 text-subtitle font-semibold">
            <ShieldCheck aria-hidden="true" className="size-5 text-brand" />
            公司资质
          </h2>
          <VerificationBadge verification={employer.verification} />
          <p className="text-body leading-relaxed">{verificationNote(employer.verification, "NZ")}</p>
          <dl className="space-y-3">
            <Info term="登记名称" value={employer.legalName} />
            <Info term={COUNTRIES.NZ.businessNumberLabel} value={employer.businessNumber} />
            <Info
              term="认证雇主"
              value={employer.verification === "accredited_employer" ? "已认证（演示）" : "未提供认证信息"}
            />
          </dl>
          <p className="text-meta leading-relaxed text-muted">演示登记与资质数据；企业验证不代表对工作条件的担保。</p>
          {isOwnEmployer && (
            <Link href="/employer/verify" className="pressable inline-flex min-h-11 items-center text-body text-brand">
              管理企业验证
            </Link>
          )}
        </section>
      </div>
      <section id="company-jobs" aria-labelledby="company-jobs-title" className="scroll-mt-20 pt-3">
        <h2 id="company-jobs-title" className="flex items-center gap-2 text-subtitle font-semibold">
          <BriefcaseBusiness aria-hidden="true" className="size-5 text-brand" />
          在招岗位 <span className="text-body font-normal text-muted">{jobs.length} 个</span>
        </h2>
        {jobs.length ? (
          <ul className="mt-3 grid grid-cols-1 items-stretch gap-3 lg:max-w-3xl">
            {jobs.map((job) => (
              // The card opens the job; 立即沟通 under it starts a chat about this job.
              <li key={job.id} className="flex min-w-0 flex-col gap-2">
                <JobCard look="app" job={job} employer={{ ...employer, name }} headingLevel={3} />
                <div className="flex justify-end">
                  <StartEmployerChat employer={employer} job={job} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`mt-3 text-body text-muted ${CARD}`}>该雇主暂时没有招聘中的职位。</p>
        )}
      </section>
    </div>
  );
}

const CARD = "rounded-card bg-surface p-4 shadow-card lg:p-6";

function Info({ term, value }: { term: string; value?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-muted">{term}</dt>
      <dd className="mt-0.5 text-body font-medium break-words">{value?.trim() || "未填写"}</dd>
    </div>
  );
}
