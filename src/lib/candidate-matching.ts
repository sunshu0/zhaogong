import { COUNTRIES, regionById, type Region } from "@/config/countries";
import { JOB_ROLE_IDS, JOB_ROLES, type JobRoleId } from "@/config/job-roles";
import { jobRoles, parseJobRoles, roleFitsIndustry } from "@/lib/job-roles";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS, LANGUAGE_LABELS } from "@/i18n/labels";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { candidateMatchingMessages } from "@/i18n/messages/candidate-matching";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { EmploymentType, Job } from "@/lib/types";

/** The wording of the factors and the facts, in the interface language (Round 20, ADR 0023). */
const words = (lang: Lang) => pick(candidateMatchingMessages, lang);
/** An area's name in the interface language; the id when the area is unknown, as before. */
const regionName = (region: Region | undefined, fallback: string, lang: Lang) =>
  region ? (lang === "en" ? region.nameEn : region.nameZh) : fallback;

export type Resume = {
  candidateId?: string;
  discoverable: boolean;
  /** 想做的岗位 (#96): categories ticked, any number. */
  roles?: JobRoleId[];
  skills: string;
  experienceYears?: number;
  employmentTypes: EmploymentType[];
  regionIds: string[];
  hoursPerWeek?: { min: number; max: number };
  expectedMinPay?: number;
};
export const EMPTY_RESUME: Resume = { discoverable: false, skills: "", employmentTypes: [], regionIds: [] };
export type Candidate = {
  id: string;
  source: "demo" | "local";
  name: string;
  avatar?: string;
  headline: string;
  location: string;
  languages: string;
  availability: string;
  bio: string;
  resume: Resume;
};

const number = (value: unknown, min: number, max: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : undefined;
export function parseResume(value: unknown): Resume {
  if (!value || typeof value !== "object") return { ...EMPTY_RESUME };
  const input = value as Record<string, unknown>;
  const list = <T extends string>(value: unknown, allowed: T[]): T[] =>
    Array.isArray(value) ? [...new Set(value.filter((item): item is T => allowed.includes(item as T)))] : [];
  const hours = input.hoursPerWeek as Record<string, unknown> | undefined;
  const min = hours && number(hours.min, 1, 80);
  const max = hours && number(hours.max, 1, 80);
  const roles = parseJobRoles(input.roles, JOB_ROLE_IDS.length);
  return {
    candidateId:
      typeof input.candidateId === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(input.candidateId)
        ? input.candidateId
        : undefined,
    discoverable: input.discoverable === true,
    roles: roles.length ? roles : undefined,
    skills: typeof input.skills === "string" ? input.skills.slice(0, 1000) : "",
    experienceYears: number(input.experienceYears, 0, 60),
    employmentTypes: list(input.employmentTypes, Object.keys(EMPLOYMENT_TYPE_LABELS) as EmploymentType[]),
    regionIds: list(
      input.regionIds,
      COUNTRIES.NZ.regions.map((item) => item.id),
    ),
    hoursPerWeek: min != null && max != null && max >= min ? { min, max } : undefined,
    expectedMinPay: number(input.expectedMinPay, 0, 200),
  };
}

/** The skills the patterns below find; the dictionary gives each one its name in the interface language. */
type SkillName = keyof (typeof candidateMatchingMessages)["zh"]["skills"];

const SKILLS: [SkillName, RegExp][] = [
  ["前厅服务", /前厅|楼面|服务员|waitstaff|front.of.house|floor staff/i],
  ["点餐", /点餐|点单|taking orders/i],
  ["上菜", /上菜|serving/i],
  ["收银", /收银|cashier|\btill\b/i],
  ["备菜", /备菜|\bprep\b/i],
  ["洗碗", /洗碗|dishwash|dishes/i],
  ["厨房清洁", /厨房清洁|厨房帮工|kitchen hand/i],
  ["点心制作", /点心(?:制作|经验|师傅)?|dim sum/i],
  ["理货", /理货|上货|货架|stocking|shelf/i],
  ["门店管理", /门店.*运营|管理经验|排班|库存|store manag/i],
  ["美发", /美发|发型|洗头|salon/i],
  ["木工", /木工|carpentr/i],
  ["Site Safe", /site safe/i],
  ["清洁", /家政|清洁员|保洁|cleaner/i],
  ["仓储", /仓库|仓储|拣货|warehouse|picking/i],
  ["叉车", /叉车|forklift/i],
  ["驾驶", /驾驶|司机|\bdriver\b/i],
  ["行政", /文员|行政|office admin/i],
  ["客服", /客服|customer service/i],
];

function positive(text: string, pattern: RegExp): boolean {
  return [...text.matchAll(new RegExp(pattern.source, "gi"))].some((match) => {
    const before = text.slice(Math.max(0, match.index - 12), match.index);
    const after = text.slice(match.index + match[0].length);
    return (
      !/(?:不会|不懂|不熟悉|不擅长|没有|缺乏|未做过|\bno|\bnot)\s*$/i.test(before) &&
      !/^(?:经验)?(?:欠缺|不足|不会|不熟悉)/.test(after)
    );
  });
}
function skillsIn(text: string) {
  return SKILLS.filter(([, re]) => positive(text, re)).map(([name]) => name);
}
const ROLE_WORDS = JOB_ROLE_IDS.map(
  (id) =>
    [
      id,
      new RegExp(JOB_ROLES[id].aliases.map((alias) => alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i"),
    ] as const,
);
/**
 * 想做的岗位: what the candidate ticked; a profile from before #96 that ticked none is read for the same words a
 * job title is, so 「前厅服务员 · 点餐」 still counts as 前厅服务.
 */
function candidateRoles(candidate: Candidate): { roles: JobRoleId[]; ticked: boolean } {
  if (candidate.resume.roles?.length) return { roles: candidate.resume.roles, ticked: true };
  const text = `${candidate.headline} ${candidate.bio} ${candidate.resume.skills}`;
  return { roles: ROLE_WORDS.filter(([, re]) => positive(text, re)).map(([id]) => id), ticked: false };
}
const LANGUAGE_WORDS = {
  mandarin: /普通话|国语|mandarin/i,
  cantonese: /粤语|广东话|cantonese/i,
  english: /英语|英文|english/i,
};
const CHINESE_YEARS: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};
function requiredYears(text: string): number | undefined {
  const hit = /(?:需|要求|至少|minimum|at least).{0,10}?(\d+(?:\.\d+)?|[一二两三四五六七八九十])\s*(?:年|years?)/i.exec(
    text,
  );
  return hit ? (CHINESE_YEARS[hit[1]] ?? Number(hit[1])) : undefined;
}

export type MatchFactor = {
  key: "skills" | "experience" | "languages" | "type" | "region" | "hours" | "pay";
  label: string;
  weight: number;
  earned: number;
  status: "matched" | "partial" | "mismatch" | "unknown" | "not_required";
  requirement: string;
  evidence: string;
};
export type CandidateMatch = { candidate: Candidate; score: number | null; coverage: number; factors: MatchFactor[] };

/** Deterministic resume evidence, not a hiring probability or an AI assessment. */
export function matchCandidate(candidate: Candidate, job: Job, lang: Lang = DEFAULT_LANG): CandidateMatch {
  const t = words(lang);
  const roleNames = (ids: readonly JobRoleId[]) => ids.map((id) => JOB_ROLES[id][lang]).join(t.listJoiner);
  const factors: MatchFactor[] = [];
  function add(
    key: MatchFactor["key"],
    weight: number,
    ratio: number | null | undefined,
    requirement: string,
    evidence: string,
  ) {
    factors.push({
      key,
      label: t.factors[key],
      weight,
      earned: ratio == null ? 0 : weight * ratio,
      status:
        ratio === undefined
          ? "not_required"
          : ratio === null
            ? "unknown"
            : ratio === 1
              ? "matched"
              : ratio === 0
                ? "mismatch"
                : "partial",
      requirement,
      evidence,
    });
  }
  const resume = candidate.resume;
  // 岗位 (#96, ADR 0013): the same category is a full match, another category of the job's industry half, and the
  // skills named in both only explain it.
  const roles = jobRoles(job);
  const wanted = candidateRoles(candidate);
  const sameRole = roles.filter((id) => wanted.roles.includes(id));
  const sameIndustry = wanted.roles.filter((id) => roleFitsIndustry(id, job.industry) && job.industry !== "other");
  const requiredSkills = skillsIn(`${job.titleZh} ${job.titleEn} ${job.descriptionZh}`);
  const knownSkills = skillsIn(`${candidate.headline} ${candidate.bio} ${resume.skills}`);
  const matchedSkills = requiredSkills.filter((skill) => knownSkills.includes(skill));
  const otherSkills = matchedSkills.filter((skill) => !roles.some((id) => JOB_ROLES[id].zh === skill));
  const skillNote = otherSkills.length ? t.role.skillNote(otherSkills.map((s) => t.skills[s]).join(t.listJoiner)) : "";
  add(
    "skills",
    30,
    !roles.length ? undefined : !wanted.roles.length ? null : sameRole.length ? 1 : sameIndustry.length ? 0.5 : 0,
    roles.length ? roleNames(roles) : t.role.jobHasNoRoles,
    !wanted.roles.length
      ? t.role.wantedMissing
      : sameRole.length
        ? (wanted.ticked ? t.role.ticked : t.role.mentioned)(roleNames(sameRole), skillNote)
        : sameIndustry.length
          ? t.role.sameIndustry(roleNames(sameIndustry), INDUSTRY_LABELS[job.industry][lang], skillNote)
          : t.role.wants(roleNames(wanted.roles), skillNote),
  );
  const years = requiredYears(job.descriptionZh);
  const relevantExperience = sameRole.length > 0;
  add(
    "experience",
    15,
    years == null
      ? undefined
      : resume.experienceYears == null || !relevantExperience
        ? null
        : resume.experienceYears >= years
          ? 1
          : 0,
    years == null ? t.experience.notRequired : t.experience.required(years),
    resume.experienceYears == null
      ? t.experience.missing
      : relevantExperience
        ? t.experience.onResume(resume.experienceYears)
        : t.experience.unclear,
  );
  const spoken = job.languages.filter((language) => positive(candidate.languages, LANGUAGE_WORDS[language]));
  add(
    "languages",
    15,
    !job.languages.length ? undefined : !candidate.languages.trim() ? null : spoken.length / job.languages.length,
    job.languages.map((item) => LANGUAGE_LABELS[item][lang]).join(t.listJoiner) || t.languages.notLimited,
    candidate.languages || t.languages.missing,
  );
  const accepted = job.employmentType;
  add(
    "type",
    15,
    !resume.employmentTypes.length ? null : resume.employmentTypes.some((type) => accepted.includes(type)) ? 1 : 0,
    formatEmploymentTypes(job.employmentType, lang),
    formatEmploymentTypes(resume.employmentTypes, lang) || t.type.missing,
  );
  add(
    "region",
    10,
    !resume.regionIds.length ? null : resume.regionIds.includes(job.regionId) ? 1 : 0,
    regionName(regionById(job.country, job.regionId), job.regionId, lang),
    resume.regionIds.map((id) => regionName(regionById("NZ", id), id, lang)).join(t.listJoiner) || t.region.missing,
  );
  const hours = job.hoursPerWeek;
  const available = resume.hoursPerWeek;
  const fullHours = hours && available && available.min <= hours.min && available.max >= (hours.max ?? hours.min);
  const overlap = hours && available && available.min <= (hours.max ?? hours.min) && available.max >= hours.min;
  add(
    "hours",
    10,
    !hours ? undefined : !available ? null : fullHours ? 1 : overlap ? 0.5 : 0,
    hours ? t.hours.job(hours.min, hours.max || hours.min) : t.hours.notFixed,
    available
      ? t.hours.available(available.min, available.max, candidate.availability || t.hours.shiftsUnknown)
      : t.hours.missing,
  );
  add(
    "pay",
    5,
    resume.expectedMinPay == null ? null : resume.expectedMinPay <= (job.pay.max ?? job.pay.min) ? 1 : 0,
    t.pay.job(job.pay.min, job.pay.max ?? null),
    resume.expectedMinPay == null ? t.pay.missing : t.pay.expected(resume.expectedMinPay),
  );
  const applicable = factors.filter((item) => item.status !== "not_required");
  const totalWeight = applicable.reduce((sum, item) => sum + item.weight, 0);
  const knownWeight = applicable
    .filter((item) => item.status !== "unknown")
    .reduce((sum, item) => sum + item.weight, 0);
  return {
    candidate,
    factors,
    score: knownWeight
      ? Math.round((applicable.reduce((sum, item) => sum + item.earned, 0) / totalWeight) * 100)
      : null,
    coverage: totalWeight ? Math.round((knownWeight / totalWeight) * 100) : 0,
  };
}

export function rankCandidates(candidates: Candidate[], job: Job, lang: Lang = DEFAULT_LANG): CandidateMatch[] {
  return candidates
    .filter((candidate) => candidate.resume.discoverable)
    .map((candidate) => matchCandidate(candidate, job, lang))
    .sort(
      (a, b) =>
        (b.score ?? -1) - (a.score ?? -1) || b.coverage - a.coverage || a.candidate.id.localeCompare(b.candidate.id),
    );
}

// ---- the recommendation card (B28); /candidates/[id] (C6) shows the same five facts ----

/** The five facts in their fixed order, in Chinese; the interface language's come from the dictionary. */
export const CANDIDATE_FACT_LABELS = ["可上班时间", "地区", "期望时薪", "语言", "经验"] as const;

/** What an employer checks first, in a fixed order, with 待补充 where the profile says nothing. */
export function candidateFacts(candidate: Candidate, lang: Lang = DEFAULT_LANG): { label: string; value: string }[] {
  const t = words(lang).facts;
  const { resume } = candidate;
  const hours = resume.hoursPerWeek && t.hours(resume.hoursPerWeek.min, resume.hoursPerWeek.max);
  const regions = resume.regionIds.map((id) => regionName(regionById("NZ", id), id, lang)).join(words(lang).listJoiner);
  const labels = [t.labels.availability, t.labels.region, t.labels.pay, t.labels.languages, t.labels.experience];
  const values = [
    [candidate.availability.trim(), hours].filter(Boolean).join(t.joiner),
    regions || candidate.location.trim(),
    resume.expectedMinPay != null ? t.payFrom(resume.expectedMinPay) : "",
    candidate.languages.trim(),
    resume.experienceYears == null
      ? ""
      : resume.experienceYears === 0
        ? t.noExperience
        : t.years(resume.experienceYears),
  ];
  return labels.map((label, i) => ({ label, value: values[i] || t.missing }));
}

const CONCERN_ORDER: Partial<Record<MatchFactor["status"], number>> = { mismatch: 0, partial: 1, unknown: 2 };

/** The two concerns that matter most: mismatches first, then partial matches, then unknowns; heavier first. */
export function keyConcerns(factors: MatchFactor[], count = 2): MatchFactor[] {
  return factors
    .filter((f) => CONCERN_ORDER[f.status] != null)
    .sort((a, b) => CONCERN_ORDER[a.status]! - CONCERN_ORDER[b.status]! || b.weight - a.weight)
    .slice(0, count);
}

/** Below this score a candidate is folded under 「另外 N 位匹配度较低」 (folded, not hidden). */
export const LOW_MATCH_SCORE = 40;

/** Matches to list, and the low ones folded below them. An unknown score is not a low one. */
export function splitLowMatches(matches: CandidateMatch[]): { shown: CandidateMatch[]; low: CandidateMatch[] } {
  const isLow = (m: CandidateMatch) => m.score !== null && m.score < LOW_MATCH_SCORE;
  return { shown: matches.filter((m) => !isLow(m)), low: matches.filter(isLow) };
}
