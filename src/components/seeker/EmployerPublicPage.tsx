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
import { sheetClass } from "@/components/ui/Card";
import type { EmployerActivity } from "@/lib/employer-activity";
import { StartEmployerChat } from "@/components/seeker/StartEmployerChat";
import { EmployerActivitySummary } from "@/components/seeker/ChatActivity";
import { EmployerAvatar } from "@/components/seeker/ProfileAvatar";
import { buttonClass } from "@/components/ui/Button";
import { employerIndustry } from "@/components/ui/industry-avatar";
import type { Employer, Job } from "@/lib/types";
import { BACK, PageTransition } from "@/components/ui/PageTransition";
import { useLang, useMessages } from "@/i18n/client";
import { seekerEmployerMessages } from "@/i18n/messages/seeker-employer";
import { contentLang } from "@/i18n/lang";
import { placeName } from "@/components/seeker/format";
import { employerPhotosMessages } from "@/i18n/messages/employer-photos";
import type { Benefit } from "@/lib/company-photos";

export function EmployerPublicPage({
  employer,
  jobs,
  activity,
  photos = [],
  benefits = [],
  demo = false,
}: {
  employer: Employer;
  /** The demo site's data (demoDataWanted): 演示企业 in place of the verification level (user feedback 10-30 #2). */
  demo?: boolean;
  jobs: Job[];
  /** 老板活跃度 on its job cards (#381). */
  activity?: EmployerActivity;
  /** Its approved shop photos' ids, oldest first (ADR 0052). */
  photos?: string[];
  benefits?: Benefit[];
}) {
  const profile = usePublicEmployerProfile(employer.id);
  const session = useSession();
  const lang = useLang();
  const t = useMessages(seekerEmployerMessages);
  const shop = useMessages(employerPhotosMessages);
  const name = profile?.name.trim() || employer.name;
  const industries = [...new Set(jobs.map((job) => INDUSTRY_LABELS[job.industry][lang]))];
  const isOwnEmployer = session?.activeRole === "employer" && session.employerId === employer.id;
  // Visual A (V2): only the jobs are cards (they open the job); the header, the introduction and the credentials
  // open nothing, so they are sheets (side by side from 1024 px). One main button: 选择职位沟通 in the header; each
  // job's 立即沟通 is a secondary button, so a screen of jobs does not show a row of orange buttons.
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
            <EmployerAvatar employerId={employer.id} fallback={name} industry={employerIndustry(jobs)} large />
            <div className="min-w-0 flex-1">
              <p className="text-meta text-muted">{t.eyebrow(employer.id)}</p>
              <h1 lang={contentLang(name)} className="mt-1 text-title font-semibold break-words">
                {name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body">
                <VerificationBadge verification={employer.verification} demo={demo} lang={lang} />
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
            {isOwnEmployer && (
              <Link
                href="/employer/photos"
                className="pressable inline-flex min-h-11 items-center text-body text-brand"
              >
                {shop.public.addPhotos}
              </Link>
            )}
          </div>
        </header>
        {/* ADR 0052: only approved photos; with none, no empty frame for visitors. */}
        {photos.length > 0 && (
          <section aria-labelledby="company-photos" className={CARD}>
            <h2 id="company-photos" className="sr-only">
              {shop.public.photosHeading}
            </h2>
            <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible">
              {photos.map((id, i) => (
                <li key={id} className="w-4/5 shrink-0 snap-start sm:w-auto">
                  {/* eslint-disable-next-line @next/next/no-img-element -- our own route, already small and cached */}
                  <img
                    src={`/api/company-photos/${id}`}
                    alt={shop.public.photoAlt(name, i + 1)}
                    loading={i < 2 ? "eager" : "lazy"}
                    className="aspect-[4/3] w-full rounded-md bg-neutral-soft object-cover"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
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
            {benefits.length > 0 && (
              <div className="space-y-2 border-t border-border pt-4">
                <h3 className="text-meta text-muted">{shop.public.benefitsHeading}</h3>
                <ul className="flex flex-wrap gap-1.5" aria-label={shop.public.benefitsHeading}>
                  {benefits.map((benefit) => (
                    <li key={benefit} className="rounded-md bg-brand-soft px-2 py-0.5 text-meta font-medium text-brand">
                      {shop.benefits.labels[benefit]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
            <VerificationBadge verification={employer.verification} demo={demo} explain={demo} lang={lang} />
            {/* 还没有完成企业验证 claims nothing, so a demo business still says it; the levels' notes do claim. */}
            {(!demo || employer.verification === "unverified") && (
              <p className="text-body leading-relaxed">{verificationNote(employer.verification, "NZ", lang)}</p>
            )}
            <dl className="space-y-3">
              <Info term={t.legalName} value={employer.legalName} empty={t.notFilled} />
              <Info term={COUNTRIES.NZ.businessNumberLabel} value={employer.businessNumber} empty={t.notFilled} />
              <Info
                term={t.accredited}
                value={!demo && employer.verification === "accredited_employer" ? t.accreditedYes : t.accreditedNone}
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
                    activity={activity}
                    headingLevel={3}
                    demo={demo}
                    lang={lang}
                    action={<StartEmployerChat employer={employer} job={job} variant="secondary" />}
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

/** A block that opens nothing (visual A, V2): a sheet, not a card. */
const CARD = `${sheetClass({ padded: false })} p-4 lg:p-6`;

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
