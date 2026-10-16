// 一键申请 (#84, PRD R-35): what an application holds and how each side sees its state. Shared by the browser and
// the server; the server parses everything a browser sends.
import { parseResume, type Candidate, type Resume } from "@/lib/candidate-matching";
import type { Profile } from "@/components/seeker/hub-state";

/** The note sent with an application. */
export const NOTE_MAX = 200;
const NAME_MAX = 40;
const LINE_MAX = 80;
const BIO_MAX = 600;

/**
 * The job seeker's page as the employer sees it (R-18), copied when they apply: the profile lives in their own
 * browser, so the employer reads this copy. No contact details (they follow the job's two rules, ADR 0002).
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

/** The employer's decision. 不合适 is never shown to the job seeker in those words. */
export type ApplicationDecision = "fit" | "unfit";
export const DECISION_LABELS: Record<ApplicationDecision, string> = { fit: "合适", unfit: "不合适" };

export function parseDecision(value: unknown): ApplicationDecision | null | undefined {
  if (value === null) return null;
  return value === "fit" || value === "unfit" ? value : undefined;
}

export function parseApplicationNote(value: unknown): { ok: true; note: string } | { ok: false; error: string } {
  const note = typeof value === "string" ? value.trim() : "";
  if ([...note].length > NOTE_MAX) return { ok: false, error: `附言最多 ${NOTE_MAX} 字` };
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

/** What the job seeker sees about their application: whether the employer looked, and only a yes as a decision. */
export function seekerStatus(application: { seenAt?: string | null; decision?: ApplicationDecision | null }): string {
  if (application.decision === "fit") return "雇主觉得合适";
  if (application.seenAt || application.decision === "unfit") return "雇主已看过";
  return "已申请，等雇主查看";
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
