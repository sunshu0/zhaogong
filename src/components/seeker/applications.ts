// 一键申请 (#84, PRD R-35): what an application holds and how each side sees its state. Shared by the browser and
// the server; the server parses everything a browser sends.
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerMeMessages } from "@/i18n/messages/seeker-me";
import { parseResume, type Candidate, type Resume } from "@/lib/candidate-matching";
import type { Profile } from "@/components/seeker/hub-state";

/** In a job page's address after sign-in from 申请: open the form (ApplyJob). */
export const APPLY_PARAM = "apply";

/** Sign-in for 申请 while signed out, coming back to the job with the form open. */
export function applyAfterSignInHref(jobId: string): string {
  return `/login?role=seeker&next=${encodeURIComponent(`/jobs/${jobId}?${APPLY_PARAM}=1`)}`;
}

/** The note sent with an application. */
export const NOTE_MAX = 200;
const NAME_MAX = 40;
const LINE_MAX = 80;
const BIO_MAX = 600;

/**
 * The job seeker's page as the employer sees it (R-18), copied when they apply: the account's page since #104 (before
 * that the page lived only in their browser), so later edits do not change what they applied with. No contact
 * details (they follow the job's two rules, ADR 0002).
 */
export type ApplicationProfile = {
  name: string;
  headline: string;
  location: string;
  languages: string;
  availability: string;
  bio: string;
  resume: Omit<Resume, "candidateId" | "discoverable">;
};

/**
 * The employer's decision: 合适, 不合适, or 已录用 (#105). 不合适 is never shown to the job seeker: they see 「雇主已看过」,
 * and once the job ends, 「职位已结束」 like everyone else who was not hired.
 */
export type ApplicationDecision = "fit" | "unfit" | "hired";
export const DECISION_LABELS: Record<ApplicationDecision, string> = { fit: "合适", unfit: "不合适", hired: "已录用" };

/** The decision's word in the page's language (Round 20); DECISION_LABELS is the Chinese. */
export function decisionLabel(decision: ApplicationDecision, lang: Lang = DEFAULT_LANG): string {
  return pick(seekerMeMessages, lang).applications.decision[decision];
}

export function parseDecision(value: unknown): ApplicationDecision | null | undefined {
  if (value === null) return null;
  return value === "fit" || value === "unfit" || value === "hired" ? value : undefined;
}

export function parseApplicationNote(
  value: unknown,
  lang: Lang = DEFAULT_LANG,
): { ok: true; note: string } | { ok: false; error: string } {
  const note = typeof value === "string" ? value.trim() : "";
  if ([...note].length > NOTE_MAX)
    return { ok: false, error: pick(seekerMeMessages, lang).applications.noteTooLong(NOTE_MAX) };
  return { ok: true, note };
}

const line = (value: unknown, max: number) =>
  typeof value === "string" ? [...value.trim()].slice(0, max).join("") : "";

/** What a browser sent as its page; null without a name (an employer needs to know who applied). */
export function parseApplicationProfile(value: unknown): ApplicationProfile | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const name = line(input.name, NAME_MAX);
  if (!name) return null;
  const { candidateId: _id, discoverable: _shown, ...resume } = parseResume(input.resume);
  void _id;
  void _shown;
  return {
    name,
    headline: line(input.headline, LINE_MAX),
    location: line(input.location, LINE_MAX),
    languages: line(input.languages, LINE_MAX),
    availability: line(input.availability, LINE_MAX),
    bio: line(input.bio, BIO_MAX),
    resume: { ...resume, skills: line(resume.skills, BIO_MAX) },
  };
}

/** The copy to send from the job seeker's own page; contact details and the avatar stay behind. */
export function applicationProfileFrom(profile: Profile): ApplicationProfile | null {
  return parseApplicationProfile(profile);
}

/** The copy as a candidate, for the five facts employers check first (candidateFacts). */
export function applicantCandidate(id: string, profile: ApplicationProfile): Candidate {
  return { id, source: "local", ...profile, resume: { ...profile.resume, discoverable: false } };
}

/**
 * What the job seeker sees about their application: whether the employer looked, and only a yes as a decision. Once
 * the job has ended (`ended`, #105), everyone not hired sees 「职位已结束」, whatever the employer marked.
 */
export function seekerStatus(
  application: { seenAt?: string | null; decision?: ApplicationDecision | null },
  ended = false,
  lang: Lang = DEFAULT_LANG,
): string {
  const t = pick(seekerMeMessages, lang).applications.status;
  if (application.decision === "hired") return t.hired;
  if (ended) return t.ended;
  if (application.decision === "fit") return t.fit;
  if (application.seenAt || application.decision === "unfit") return t.seen;
  return t.waiting;
}

/** 进行中 or 已结束 in 我的申请 (#105): an application is over once the person is hired or the job has ended. */
export function applicationStage(decision: ApplicationDecision | null | undefined, ended: boolean): "open" | "ended" {
  return decision === "hired" || ended ? "ended" : "open";
}

/**
 * When a job stopped taking people (#105), or null while it is open: closed by the employer or past its closing date
 * (expires_at, which closing sets to the moment), or taken down (`takenDownAt`, from the moderation log, when known).
 */
export function jobEndedAt(
  job: { status: string; expiresAt: string },
  now: number,
  takenDownAt?: string,
): string | null {
  if (job.status === "removed") return takenDownAt ?? new Date(Math.min(Date.parse(job.expiresAt), now)).toISOString();
  if (job.status === "pending_review") return null;
  return job.status === "expired" || Date.parse(job.expiresAt) <= now ? job.expiresAt : null;
}

/** The job seeker's notification that the employer hired them (#105). */
export function hiredNotificationId(applicationId: string): string {
  return `hired:${applicationId}`;
}

/** The job seeker's notification that a job they applied for has ended (#105). */
export function jobEndedNotificationId(applicationId: string): string {
  return `job-ended:${applicationId}`;
}

/** The employer's notification about one application (#84). */
export function applicationNotificationId(applicationId: string): string {
  return `apply:${applicationId}`;
}

/** The employer's chat with someone who applied (#84). */
export function applicantConversationId(applicationId: string): string {
  return `apply:${applicationId}`;
}

/** Why an application cannot go through, as a sentence for the page. */
export const APPLY_ERRORS = {
  signed_out: "请先登录",
  employer_identity: "请切换为求职者再申请",
  no_profile: "请先在「我的主页」填好名字，雇主会看到你的主页",
  closed: "这个职位已截止或已下架，不能申请",
  banned: "这家企业已被封禁，不能申请",
  own_job: "不能申请自己企业的职位",
  already: "你已经申请过这个职位",
  note_too_long: `附言最多 ${NOTE_MAX} 字`,
} as const;
export type ApplyRefusal = keyof typeof APPLY_ERRORS;

/** Why an application cannot go through, in the visitor's language (Round 20). */
export function applyError(reason: ApplyRefusal, lang: Lang = DEFAULT_LANG): string {
  const refused = pick(seekerMeMessages, lang).applications.refused;
  return reason === "note_too_long" ? refused.note_too_long(NOTE_MAX) : refused[reason];
}
