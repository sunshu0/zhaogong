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
import { LoadFailed } from "@/components/ui/LoadFailed";
import { employerCommonMessages } from "@/i18n/messages/employer-common";
import { Section } from "@/components/ui/Section";
import { APP_CARD } from "@/components/employer/app-style";
import { Pay } from "@/components/ui/Pay";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { regionById } from "@/config/countries";
import { useLang, useMessages } from "@/i18n/client";
import { contentLang, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { candidateMatchingMessages } from "@/i18n/messages/candidate-matching";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";
import type { Job } from "@/lib/types";

/** candidateFacts()'s 「待补充」, so a fact nobody filled in is greyed out. */
const factsMissing = (lang: Lang) => pick(candidateMatchingMessages, lang).facts.missing;

const STATUS_STYLE: Record<MatchFactor["status"], string> = {
  matched: "text-ok bg-ok-soft",
  partial: "text-warn bg-warn-soft",
  mismatch: "text-danger bg-danger-soft",
  unknown: "text-muted bg-background",
  not_required: "text-muted bg-background",
};

/** An area's name in the interface language (config/countries.ts), empty when the job's area is unknown. */
const areaName = (country: Job["country"], regionId: string, lang: Lang) => {
  const region = regionById(country, regionId);
  return region ? (lang === "en" ? region.nameEn : region.nameZh) : "";
};

export function CandidateRecommendations() {
  return (
    <EmployerGate next="/employer/candidates">{(me) => <Recommendations key={me.employerId} me={me} />}</EmployerGate>
  );
}

function Recommendations({ me }: { me: EmployerIdentity }) {
  const t = useMessages(employerApplicantsMessages).candidateRecommendations;
  const names = useMessages(employerCommonMessages).load;
  const lang = useLang();
  const { ready, failed, reload } = useMyJobs(me.email);
  const { candidates } = useCandidateDirectory();
  const [jobId, setJobId] = useState("");
  const [query, setQuery] = useState("");
  const [minimum, setMinimum] = useState("0");
  if (failed) return <LoadFailed what={names.jobs} onRetry={reload} />;
  if (!ready) return <SkeletonList count={3} label={t.loadingJobs} />;
  const jobs = ready.jobs.filter((job) => job.status === "active" && Date.parse(job.expiresAt) > ready.now);
  const job = jobs.find((item) => item.id === jobId) ?? jobs[0];
  const matches = job
    ? rankCandidates(candidates, job, lang).filter(
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
        <p className="text-meta text-muted">
          {t.workspaceBefore}
          <span lang={contentLang(me.employerName)}>{me.employerName}</span>
        </p>
        <h1 className="mt-1 text-title font-semibold">{t.title}</h1>
        <p className="mt-1 text-body text-muted">{t.intro}</p>
      </header>
      {!job ? (
        <Section look="app">
          <div className="space-y-3 py-10 text-center">
            <h2 className="text-subtitle font-semibold">{t.noOpenJobs}</h2>
            <ButtonLink href="/employer/post">{t.postJob}</ButtonLink>
            <p>
              <Link href="/employer/jobs" className="text-body text-brand underline">
                {t.manageJobs}
              </Link>
            </p>
          </div>
        </Section>
      ) : (
        <>
          <section aria-label={t.filtersLabel} className={`${APP_CARD} space-y-4`}>
            <Select
              name="job"
              label={t.jobLabel}
              required
              options={jobs.map((item) => ({
                value: item.id,
                label: t.jobOption(item.titleZh, areaName(item.country, item.regionId, lang)),
                lang: contentLang(item.titleZh),
              }))}
              defaultValue={job.id}
              onChange={setJobId}
            />
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 text-body text-muted">
              <Pay pay={job.pay} country={job.country} lang={lang} />
              <span>{formatEmploymentTypes(job.employmentType, lang)}</span>
              <span>
                {job.hoursPerWeek
                  ? t.hoursRange(job.hoursPerWeek.min, job.hoursPerWeek.max ?? job.hoursPerWeek.min)
                  : t.hoursUnknown}
              </span>
              <Link href={`/jobs/${job.id}`} className="text-brand underline">
                {t.seeRequirements}
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
              <label className="block space-y-1 text-body">
                <span className="block text-meta text-muted">{t.searchLabel}</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="h-11 w-full rounded-control border border-border bg-surface px-3 focus:border-brand"
                />
              </label>
              <Select
                name="minimum"
                label={t.minimumLabel}
                required
                options={[
                  { value: "0", label: t.minimumAll },
                  { value: "60", label: t.minimumAtLeast(60) },
                  { value: "80", label: t.minimumAtLeast(80) },
                ]}
                defaultValue={minimum}
                onChange={setMinimum}
              />
            </div>
          </section>
          <Section
            look="app"
            title={t.listTitle(matches.length)}
            action={<span className="text-meta text-muted">{t.sortNote}</span>}
          >
            {!matches.length ? (
              <p role="status" className="py-12 text-center text-body text-muted">
                {t.noMatches}
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
  const t = useMessages(employerApplicantsMessages).candidateRecommendations;
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
        <section aria-label={t.lowMatchesLabel}>
          <button
            type="button"
            aria-expanded={showLow}
            aria-controls={`low-${job.id}`}
            onClick={() => setShowLow((v) => !v)}
            className="pressable-row -mx-4 flex min-h-11 w-[calc(100%+2rem)] items-center justify-between px-4 py-3 text-body text-muted lg:-mx-5 lg:w-[calc(100%+2.5rem)] lg:px-5"
          >
            {t.moreLowMatches(low.length)}
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
  const t = useMessages(employerApplicantsMessages).candidateRecommendations;
  const lang = useLang();
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
              <h3 lang={contentLang(candidate.name)} className="break-words text-subtitle font-semibold">
                {candidate.name}
              </h3>
              <span className="text-meta text-muted">
                {candidate.source === "demo" ? t.sourceDemo : t.sourcePublic}
              </span>
            </div>
            <p lang={contentLang(candidate.headline)} className="mt-1 break-words text-body">
              {candidate.headline || t.headlineEmpty}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-meta text-muted">{t.score}</p>
            <p className="mt-1 leading-none text-brand">
              {score === null ? (
                <span className="text-subtitle font-semibold">{t.scoreUnknown}</span>
              ) : (
                <>
                  <span className="font-figure text-[1.875rem]">{score}</span>
                  <span className="ml-0.5 text-meta font-medium text-muted">{t.scoreOutOf}</span>
                </>
              )}
            </p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-body">
          {candidateFacts(candidate, lang).map((fact) => (
            <div key={fact.label} className="contents">
              <dt className="text-muted">{fact.label}</dt>
              <dd
                lang={contentLang(fact.value)}
                className={`break-words ${fact.value === factsMissing(lang) ? "text-muted" : ""}`}
              >
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 break-words text-meta text-muted">
          {concerns.length
            ? t.concerns(concerns.map((item) => t.concernItem(item.label, t.matchStatus[item.status])))
            : t.allMatched}
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
            {expanded ? t.hideResume : t.showResume}
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
            {t.startChat}
          </Button>
        </div>
      </div>
      {expanded && (
        <div id={`resume-${candidate.id}`} className="space-y-4 border-t border-dashed border-border pb-5 pt-4">
          <section aria-label={t.resumeLabel} className="space-y-2 text-body">
            <h4 className="font-semibold">{t.resumeTitle}</h4>
            <p lang={contentLang(candidate.bio)} className="break-words leading-relaxed">
              {candidate.bio || t.bioEmpty}
            </p>
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-meta text-muted">{t.skills}</dt>
                <dd lang={contentLang(candidate.resume.skills)} className="break-words">
                  {candidate.resume.skills || t.fieldEmpty}
                </dd>
              </div>
              <div>
                <dt className="text-meta text-muted">{t.wants}</dt>
                <dd>{formatEmploymentTypes(candidate.resume.employmentTypes, lang) || t.fieldEmpty}</dd>
              </div>
            </dl>
          </section>
          <section aria-label={t.analysisLabel}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-body font-semibold">{t.analysisTitle}</h4>
              <p className="text-meta text-muted">{t.coverage(coverage)}</p>
            </div>
            <p className="mt-2 text-meta text-muted">{t.weighting}</p>
            <ul className="mt-3 divide-y divide-border">
              {factors.map((item) => (
                <li key={item.key} className="py-3">
                  <div className="flex items-center justify-between gap-2 text-body">
                    <p className="font-medium">
                      {item.label}
                      <span className="ml-2 text-meta text-muted">
                        {item.status === "not_required" ? t.notScored : t.earned(Math.round(item.earned), item.weight)}
                      </span>
                    </p>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-meta ${STATUS_STYLE[item.status]}`}>
                      {t.matchStatus[item.status]}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-meta text-muted">{t.requirement(item.requirement)}</p>
                  {/* What the resume says: 语言 is the candidate's own line, the rest the dictionary's wording. */}
                  <p lang={contentLang(item.evidence)} className="mt-1 break-words text-body">
                    {item.evidence}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </article>
  );
}
