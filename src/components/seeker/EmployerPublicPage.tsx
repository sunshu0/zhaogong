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
import { BACK, PageTransition } from "@/components/ui/PageTransition";
import { useLang, useMessages } from "@/i18n/client";
import { seekerEmployerMessages } from "@/i18n/messages/seeker-employer";
import { contentLang } from "@/i18n/lang";
import { placeName } from "@/components/seeker/format";

export function EmployerPublicPage({ employer, jobs }: { employer: Employer; jobs: Job[] }) {
  const profile = usePublicEmployerProfile(employer.id);
  const session = useSession();
  const lang = useLang();
  const t = useMessages(seekerEmployerMessages);
  const name = profile?.name.trim() || employer.name;
  const industries = [...new Set(jobs.map((job) => INDUSTRY_LABELS[job.industry][lang]))];
  const isOwnEmployer = session?.activeRole === "employer" && session.employerId === employer.id;
  // Round 19: the page wears the sample's type and cards — a header card, the introduction and the credentials as
  // cards side by side from 1024 px, and the jobs as the job list's cards.
  return (
    <PageTransition>
      <div className="type-app space-y-3">
        <Link
          href="/jobs"
          transitionTypes={BACK}
          className="pressable inline-flex min-h-11 items-center text-meta text-brand"
        >
          {t.back}
        </Link>
        <header className={CARD}>
          <div className="flex items-start gap-4">
            <EmployerAvatar employerId={employer.id} fallback={name} large />
            <div className="min-w-0 flex-1">
              <p className="text-meta text-muted">{t.eyebrow(employer.id)}</p>
              <h1 lang={contentLang(name)} className="mt-1 text-title font-semibold break-words">
                {name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body">
                <VerificationBadge verification={employer.verification} lang={lang} />
                <span className="inline-flex items-center gap-1 text-muted">
                  <MapPin aria-hidden="true" className="size-4 shrink-0" />
                  {placeName(regionById("NZ", employer.regionId), lang) ?? t.noRegion}
                </span>
                {industries.length > 0 && <span className="text-muted">{industries.join(" / ")}</span>}
              </div>
            </div>
          </div>
          {profile?.headline && (
            <p lang={contentLang(profile.headline)} className="mt-4 text-body break-words">
              {profile.headline}
            </p>
          )}
          <EmployerActivitySummary employerId={employer.id} />
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {jobs.length > 0 ? (
              <a href="#company-jobs" className={`${buttonClass("primary", { size: "lg" })} font-semibold`}>
                <MessageSquare aria-hidden="true" className="size-4" />
                {t.chooseJob}
                <span className="text-meta">{jobs.length}</span>
              </a>
            ) : (
              <span className="inline-flex min-h-11 items-center text-body text-muted">{t.noOpenJobs}</span>
            )}
            <a href="#company-credentials" className="pressable inline-flex min-h-11 items-center text-body text-brand">
              {t.seeVerification}
            </a>
            {isOwnEmployer && (
              <Link href="/profile" className="pressable inline-flex min-h-11 items-center text-body text-brand">
                {t.edit}
              </Link>
            )}
          </div>
        </header>
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="company-about" className={`space-y-3 ${CARD}`}>
            <h2 id="company-about" className="flex items-center gap-2 text-subtitle font-semibold">
              <Building2 aria-hidden="true" className="size-5 text-brand" />
              {t.about}
            </h2>
            <p lang={contentLang(profile?.bio)} className="text-body leading-relaxed break-words whitespace-pre-line">
              {profile?.bio || t.noAbout}
            </p>
            <dl className="grid grid-cols-2 gap-4 border-t border-border pt-4">
              <Info term={t.address} value={profile?.location} empty={t.notFilled} />
              <Info term={t.contactName} value={profile?.contactName} empty={t.notFilled} />
              <Info term={t.languages} value={profile?.languages} empty={t.notFilled} />
              <Info term={t.contactHours} value={profile?.availability} empty={t.notFilled} />
            </dl>
          </section>
          <section
            id="company-credentials"
            aria-labelledby="company-credentials-title"
            className={`scroll-mt-20 space-y-3 ${CARD}`}
          >
            <h2 id="company-credentials-title" className="flex items-center gap-2 text-subtitle font-semibold">
              <ShieldCheck aria-hidden="true" className="size-5 text-brand" />
              {t.verification}
            </h2>
            <VerificationBadge verification={employer.verification} lang={lang} />
            <p className="text-body leading-relaxed">{verificationNote(employer.verification, "NZ", lang)}</p>
            <dl className="space-y-3">
              <Info term={t.legalName} value={employer.legalName} empty={t.notFilled} />
              <Info term={COUNTRIES.NZ.businessNumberLabel} value={employer.businessNumber} empty={t.notFilled} />
              <Info
                term={t.accredited}
                value={employer.verification === "accredited_employer" ? t.accreditedYes : t.accreditedNone}
                empty={t.notFilled}
              />
            </dl>
            <p className="text-meta leading-relaxed text-muted">{t.demoNote}</p>
            {isOwnEmployer && (
              <Link
                href="/employer/verify"
                className="pressable inline-flex min-h-11 items-center text-body text-brand"
              >
                {t.manageVerification}
              </Link>
            )}
          </section>
        </div>
        <section id="company-jobs" aria-labelledby="company-jobs-title" className="scroll-mt-20 pt-3">
          <h2 id="company-jobs-title" className="flex items-center gap-2 text-subtitle font-semibold">
            <BriefcaseBusiness aria-hidden="true" className="size-5 text-brand" />
            {t.openJobs} <span className="text-body font-normal text-muted">{t.openJobsCount(jobs.length)}</span>
          </h2>
          {jobs.length ? (
            <ul className="mt-3 grid grid-cols-1 items-stretch gap-3 lg:max-w-3xl">
              {jobs.map((job) => (
                // The card opens the job; 立即沟通 in its bottom row starts a chat about this job.
                <li key={job.id} className="min-w-0">
                  <JobCard
                    look="app"
                    job={job}
                    employer={{ ...employer, name }}
                    headingLevel={3}
                    lang={lang}
                    action={<StartEmployerChat employer={employer} job={job} />}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className={`mt-3 text-body text-muted ${CARD}`}>{t.noJobs}</p>
          )}
        </section>
      </div>
    </PageTransition>
  );
}

const CARD = "rounded-card bg-surface p-4 shadow-card lg:p-6";

function Info({ term, value, empty }: { term: string; value?: string; empty: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-meta text-muted">{term}</dt>
      <dd lang={contentLang(value)} className="mt-0.5 text-body font-medium break-words">
        {value?.trim() || empty}
      </dd>
    </div>
  );
}
