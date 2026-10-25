"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  decideMyApplicant,
  getMyJobApplicants,
  markMyApplicantsSeen,
  type Applicant,
} from "@/app/[lang]/employer/applicant-actions";
import type { Job } from "@/lib/types";
import { EmployerGate, type EmployerIdentity } from "@/components/employer/EmployerGate";
import { decisionLabel, type ApplicationDecision } from "@/components/seeker/applications";
import { useChat } from "@/components/seeker/chat-client";
import { Section } from "@/components/ui/Section";
import { BACK_LINK } from "@/components/employer/app-style";
import { toast } from "@/components/ui/Toast";
import { Tag } from "@/components/ui/Tag";
import { buttonClass } from "@/components/ui/Button";
import { busyProps } from "@/components/ui/busy";
import { InterviewInvite } from "@/components/employer/InterviewInvite";
import type { InterviewView } from "@/components/seeker/interviews";
import { SkeletonList } from "@/components/ui/Skeleton";
import { LoadFailed } from "@/components/ui/LoadFailed";
import { TrackView } from "@/components/ui/TrackView";
import { employerCommonMessages } from "@/i18n/messages/employer-common";
import { PILL_TABS, TabList, TabPanel, pillTab, tabIds } from "@/components/employer/Tabs";
import {
  applicantFilterCounts,
  applicantFilters,
  filterApplicants,
  type ApplicantFilter,
} from "@/components/employer/applicant-filter";
import { useLang, useMessages } from "@/i18n/client";
import { formatDate } from "@/i18n/format";
import { pick } from "@/i18n/messages";
import { candidateMatchingMessages } from "@/i18n/messages/candidate-matching";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";
import { contentLang, type Lang } from "@/i18n/lang";

const FILTER_ID_BASE = "applicant-filter";

/** 「10/16 15:05」 / "16/10, 3:05 pm": English reads a padded hour as "03:05 pm", so there the hour is plain. */
const appliedAtOptions = (lang: Lang): Intl.DateTimeFormatOptions => ({
  month: "numeric",
  day: "numeric",
  hour: lang === "en" ? "numeric" : "2-digit",
  minute: "2-digit",
});

/** Whether a fact is the 「待补充」 of candidateFacts(), which applicant-actions.ts builds in the request's language. */
const isMissingFact = (value: string, lang: Lang) => value === pick(candidateMatchingMessages, lang).facts.missing;

/**
 * 聊过这个职位的人 (ADR 0030; 申请人 before, #84, R-35): who chatted about one of the business's jobs or applied for
 * it, oldest first, each with 合适 / 不合适 / 已录用 (#105), a chat with them, and 约面试 (#103); those who applied
 * also with the five facts and the note. Once shown, everyone in it counts as seen. No contact details: those follow
 * the job's two rules (ADR 0002). Pills above the list show one kind at a time (#192).
 */
export function JobApplicants({ jobId }: { jobId: string }) {
  return (
    <EmployerGate next={`/employer/jobs/${jobId}/applicants`}>{(me) => <List jobId={jobId} me={me} />}</EmployerGate>
  );
}

function List({ jobId, me }: { jobId: string; me: EmployerIdentity }) {
  const t = useMessages(employerApplicantsMessages).jobApplicants;
  const names = useMessages(employerCommonMessages).load;
  const lang = useLang();
  const [loaded, setLoaded] = useState<{ email: string; data: { job: Job; applicants: Applicant[] } | null }>();
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<ApplicantFilter>("all");
  // #256: the marks on their way, by card (the button pressed); that card's other marks wait for it.
  const [deciding, setDeciding] = useState<Readonly<Record<string, ApplicationDecision>>>({});
  // #256: where the focus goes once a marked card has left the filtered list: the next applicant's marks, else the
  // filter's own tab. Read after the render that took the card away.
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    document.getElementById(target)?.focus();
  });
  // #246: the ask (by its version, which 重试 moves on) that got no answer.
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState<{ email: string; version: number }>();

  useEffect(() => {
    let live = true;
    getMyJobApplicants(jobId).then(
      (data) => {
        if (!live) return;
        setLoaded({ email: me.email, data });
        // Shown with 新 marked; from now on they count as seen.
        if (data?.applicants.some((a) => a.isNew)) void markMyApplicantsSeen(jobId).catch(() => {});
      },
      () => {
        if (live) setFailed({ email: me.email, version });
      },
    );
    return () => {
      live = false;
    };
  }, [jobId, me.email, version]);

  if (failed?.email === me.email && failed.version === version) {
    return <LoadFailed what={names.applicants} onRetry={() => setVersion((v) => v + 1)} />;
  }
  if (loaded?.email !== me.email) return <SkeletonList count={2} />;
  if (!loaded.data) {
    return (
      <div className="rounded-card bg-surface px-4 py-8 ring-1 ring-border text-center text-body text-muted">
        {t.notFound}
        <Link href="/employer/jobs" className="mt-3 block text-brand underline">
          {t.backToJobs}
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

  async function decide(id: string, decision: ApplicationDecision | null, button: ApplicationDecision) {
    if (deciding[id]) return;
    setError("");
    setDeciding((now) => ({ ...now, [id]: button }));
    const shown = filterApplicants(applicants, filter);
    const ok = await decideMyApplicant(id, decision).catch(() => false);
    setDeciding((now) => Object.fromEntries(Object.entries(now).filter(([key]) => key !== id)));
    if (!ok) return setError(t.saveFailed);
    toast(decision ? t.marked(decisionLabel(decision, lang)) : t.markCleared);
    // Marked out of the filter (未处理 → 合适, say), the card goes, and the pressed button with it.
    if (filterApplicants([{ decision }], filter).length === 0) {
      const at = shown.findIndex((a) => a.id === id);
      const next = shown[at + 1] ?? shown[at - 1];
      focusNext.current = next ? markButtonId(next.id) : tabIds(FILTER_ID_BASE, filter).tab;
    }
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
      {/* #316 (ADR 0025): the employer looked at a job's applicants. */}
      <TrackView event={{ name: "applicants_view", path: "/employer/jobs/[id]/applicants", jobId: job.id }} />
      <div>
        <Link href="/employer/jobs" className={BACK_LINK}>
          {t.back}
        </Link>
        <h1 className="mt-1 text-title font-semibold">{t.title}</h1>
        <p className="text-body text-muted">
          <span lang={contentLang(job.titleZh)}>{job.titleZh}</span>
          {t.jobSummaryCount(applicants.length)}
        </p>
        <p className="mt-1 text-meta text-muted">{t.privacyNote}</p>
      </div>

      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}

      {applicants.length === 0 ? (
        <Section look="sheet">
          <p className="py-group text-center text-body text-muted">{t.empty}</p>
        </Section>
      ) : (
        <div className="space-y-3">
          <ApplicantFilterTabs applicants={applicants} value={filter} onChange={setFilter} />
          <TabPanel idBase={FILTER_ID_BASE} value={filter}>
            {filterApplicants(applicants, filter).length === 0 ? (
              <Section look="sheet">
                <p className="py-group text-center text-body text-muted">{t.emptyInFilter}</p>
              </Section>
            ) : (
              <ul aria-label={t.listLabel} className="space-y-3">
                {filterApplicants(applicants, filter).map((a) => (
                  <li key={a.id}>
                    <ApplicantCard
                      applicant={a}
                      job={job}
                      busy={deciding[a.id]}
                      onDecide={(d, button) => void decide(a.id, d, button)}
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
  const t = useMessages(employerApplicantsMessages).applicantFilter;
  const lang = useLang();
  const counts = applicantFilterCounts(applicants);
  return (
    <TabList
      label={t.tabsLabel}
      idBase={FILTER_ID_BASE}
      tabs={applicantFilters(lang).map((f) => ({ key: f.key, label: t.tab(f.label, counts[f.key]) }))}
      value={value}
      onChange={onChange}
      className={PILL_TABS}
      tabClassName={pillTab}
    />
  );
}

/** The first mark button of an applicant's card, where the focus goes when the card before it leaves the list. */
const markButtonId = (applicationId: string) => `applicant-marks-${applicationId}`;

function ApplicantCard({
  applicant: a,
  job,
  busy,
  onDecide,
  onInterview,
}: {
  applicant: Applicant;
  job: Job;
  /** The mark button whose answer is on its way (#256): it shows busy and keeps the focus; the others wait. */
  busy?: ApplicationDecision;
  onDecide: (decision: ApplicationDecision | null, button: ApplicationDecision) => void;
  onInterview: (interview: InterviewView) => void;
}) {
  const t = useMessages(employerApplicantsMessages).jobApplicants;
  const lang = useLang();
  const router = useRouter();
  const { openApplicantChat } = useChat();
  const [opening, setOpening] = useState(false);
  const name = a.name || t.someone;
  const when = formatDate(a.appliedAt, lang, appliedAtOptions(lang));
  return (
    <article aria-label={t.cardLabel(name)} className="rounded-card bg-surface p-4 ring-1 ring-border lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-subtitle font-semibold">
            <span lang={contentLang(name)}>{name}</span>
            {a.isNew && <Tag kind="urgent">{t.isNew}</Tag>}
            {a.decision && (
              <Tag kind={a.decision === "unfit" ? "neutral" : "perk"}>{decisionLabel(a.decision, lang)}</Tag>
            )}
          </h2>
          {a.profile?.headline && (
            <p lang={contentLang(a.profile.headline)} className="text-body text-muted">
              {a.profile.headline}
            </p>
          )}
        </div>
        <p className="text-meta text-muted">{a.source === "chat" ? t.chattedAt(when) : t.appliedAt(when)}</p>
      </div>

      {/* ADR 0030: someone from a chat handed over no page here (ADR 0002). */}
      {a.facts.length ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-body">
          {a.facts.map((f) => (
            <div key={f.label} className="contents">
              <dt className="text-muted">{f.label}</dt>
              <dd lang={contentLang(f.value)} className={isMissingFact(f.value, lang) ? "text-muted" : ""}>
                {f.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-body text-muted">{t.fromChat}</p>
      )}
      {a.note && (
        <p className="mt-3 rounded-control bg-background px-3 py-2 text-body">
          {t.noteLabel}
          <span lang={contentLang(a.note)}>{a.note}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* ADR 0036: the same button on every applicant, so a secondary one (one main button a screen). */}
        <button
          type="button"
          className={buttonClass("secondary")}
          {...busyProps(opening)}
          onClick={async () => {
            // The conversation is the one the job seeker has too (#110); its id comes from the server.
            setOpening(true);
            const id = await openApplicantChat({ id: a.id }, job).catch(() => null);
            if (id) router.push(`/messages?conversation=${encodeURIComponent(id)}`);
            else setOpening(false);
          }}
        >
          {a.source === "chat" ? t.openChat : t.startChat}
        </button>
        <div role="group" aria-label={t.markGroupLabel(name)} className="flex gap-2">
          {(["fit", "unfit", "hired"] as const).map((d, i) => (
            <button
              key={d}
              id={i === 0 ? markButtonId(a.id) : undefined}
              type="button"
              aria-pressed={a.decision === d}
              onClick={() => onDecide(a.decision === d ? null : d, d)}
              className={`${buttonClass("secondary")} ${a.decision === d ? "bg-brand-soft" : ""}`}
              {...busyProps(busy !== undefined)}
              aria-busy={busy === d || undefined}
            >
              {decisionLabel(d, lang)}
            </button>
          ))}
        </div>
      </div>
      <InterviewInvite applicationId={a.id} name={name} interview={a.interview} onChange={onInterview} />
    </article>
  );
}
