// 中英文简历 (#86, PRD R-37): one page in Chinese and English, made from the job seeker's own page. The English
// side shows only what the person wrote in English; a missing field is listed for them to fill in, never machine
// translated. Fixed values (regions, employment types, pay, hours, visa type) use the platform's own English
// labels. Shared by the browser (print) and the server (share link); the server parses everything a browser sends.
import { regionById } from "@/config/countries";
import { EMPLOYMENT_TYPE_LABELS } from "@/i18n/labels";
import { parseResume, type Resume } from "@/lib/candidate-matching";
import type { VisaAccepted } from "@/lib/types";

/** The free-text fields of the page, each written once in Chinese and once in English. */
export const RESUME_TEXT_FIELDS = [
  "name",
  "headline",
  "location",
  "languages",
  "availability",
  "skills",
  "bio",
] as const;
export type ResumeTextField = (typeof RESUME_TEXT_FIELDS)[number];
export type ResumeText = Record<ResumeTextField, string>;

const TEXT_MAX: Record<ResumeTextField, number> = {
  name: 40,
  headline: 80,
  location: 80,
  languages: 80,
  availability: 80,
  skills: 600,
  bio: 600,
};

export const TEXT_LABELS: Record<ResumeTextField, { zh: string; en: string }> = {
  name: { zh: "称呼", en: "Name" },
  headline: { zh: "一句话介绍", en: "Headline" },
  location: { zh: "地区", en: "Location" },
  languages: { zh: "语言", en: "Languages" },
  availability: { zh: "可上班时间", en: "Availability" },
  skills: { zh: "技能", en: "Skills" },
  bio: { zh: "个人介绍", en: "About me" },
};

/** The visa the person holds, as they state it. Facts only: no advice, no judgement of what it allows. */
export type WorkRights = { visa: VisaAccepted; weeklyHours?: number };

/** A person's own visa, worded for them (the job labels describe who a job accepts). */
export const HELD_VISA_LABELS: Record<VisaAccepted, { zh: string; en: string }> = {
  citizen_resident: { zh: "公民 / 永居", en: "Citizen / resident" },
  open_work: { zh: "持开放工签", en: "Open work visa" },
  aewv: { zh: "持 AEWV 工签", en: "Accredited Employer Work Visa (AEWV)" },
  student: { zh: "持学签", en: "Student visa" },
  working_holiday: { zh: "持打工度假签证", en: "Working holiday visa" },
};

/** Which contact details go on the page. The share link never carries the email. */
export type ResumeContactChoice = { phone: boolean; wechat: boolean; email: boolean };
export const NO_CONTACT: ResumeContactChoice = { phone: false, wechat: false, email: false };
export type ResumeContact = { phone?: string; wechat?: string; email?: string };

export type ResumeFacts = Omit<Resume, "candidateId" | "discoverable" | "skills">;

/** What the resume page and the share page print. */
export type ResumeDoc = {
  zh: ResumeText;
  en: ResumeText;
  facts: ResumeFacts;
  workRights?: WorkRights;
  contact: ResumeContact;
};

/** The parts of a job seeker's page (Profile in hub-state) the resume reads. */
export type ResumeSource = {
  name: string;
  headline: string;
  location: string;
  languages: string;
  availability: string;
  bio: string;
  resume?: Resume;
  english?: Partial<ResumeText>;
  workRights?: WorkRights;
  resumeContact?: ResumeContactChoice;
  privateDetails?: { phone: string; wechat: string; email: string };
};

const line = (value: unknown, max: number) =>
  typeof value === "string" ? [...value.trim()].slice(0, max).join("") : "";

function parseText(value: unknown): ResumeText {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return Object.fromEntries(
    RESUME_TEXT_FIELDS.map((field) => [field, line(input[field], TEXT_MAX[field])]),
  ) as ResumeText;
}

/** The English a browser keeps; fields never written are left out. */
export function parseEnglish(value: unknown): Partial<ResumeText> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const english: Partial<ResumeText> = {};
  for (const field of RESUME_TEXT_FIELDS)
    if (typeof input[field] === "string")
      english[field] = [...(input[field] as string)].slice(0, TEXT_MAX[field]).join("");
  return english;
}

export function parseWorkRights(value: unknown): WorkRights | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  const visa = input.visa as VisaAccepted;
  if (!(visa in HELD_VISA_LABELS)) return undefined;
  const hours = input.weeklyHours;
  const weeklyHours =
    visa !== "citizen_resident" && typeof hours === "number" && Number.isFinite(hours) && hours > 0 && hours <= 80
      ? hours
      : undefined;
  return weeklyHours == null ? { visa } : { visa, weeklyHours };
}

export function parseContactChoice(value: unknown): ResumeContactChoice | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as Record<string, unknown>;
  return { phone: input.phone === true, wechat: input.wechat === true, email: input.email === true };
}

/** The page as printed from the person's own browser, with the contact details they ticked. */
export function resumeDocFrom(source: ResumeSource): ResumeDoc {
  const { candidateId: _id, discoverable: _shown, skills, ...facts } = parseResume(source.resume);
  void _id;
  void _shown;
  const choice = source.resumeContact ?? NO_CONTACT;
  const details = source.privateDetails;
  const contact: ResumeContact = {};
  for (const key of ["phone", "wechat", "email"] as const) {
    const value = details?.[key]?.trim();
    if (choice[key] && value) contact[key] = value.slice(0, 80);
  }
  return {
    zh: parseText({ ...source, skills }),
    en: parseText(source.english),
    facts,
    workRights: parseWorkRights(source.workRights),
    contact,
  };
}

/** What a browser sent to share; null without a name. The email is dropped: a share link never shows it. */
export function parseResumeDoc(value: unknown): ResumeDoc | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const zh = parseText(input.zh);
  if (!zh.name) return null;
  const { candidateId: _id, discoverable: _shown, skills: _skills, ...facts } = parseResume(input.facts);
  void _id;
  void _shown;
  void _skills;
  const contactInput = (input.contact && typeof input.contact === "object" ? input.contact : {}) as Record<
    string,
    unknown
  >;
  const contact: ResumeContact = {};
  for (const key of ["phone", "wechat"] as const) {
    const value = line(contactInput[key], 80);
    if (value) contact[key] = value;
  }
  return { zh, en: parseText(input.en), facts, workRights: parseWorkRights(input.workRights), contact };
}

/** The share copy of a printed page: the same, less the email. */
export function shareCopy(doc: ResumeDoc): ResumeDoc {
  const { email: _email, ...contact } = doc.contact;
  void _email;
  return { ...doc, contact };
}

export type ResumeRow = { id: string; zhLabel: string; enLabel: string; zh: string; en: string };

const years = (n: number) => ({
  zh: n === 0 ? "无经验" : `${n} 年`,
  en: n === 0 ? "No experience yet" : `${n} ${n === 1 ? "year" : "years"}`,
});

/** One fact in both languages, or its Chinese with the English the person wrote (empty when they have not). */
type Pair = { zh: string; en: string };
const join = (parts: Pair[], separator: Pair) => ({
  zh: parts
    .map((p) => p.zh)
    .filter(Boolean)
    .join(separator.zh),
  en: parts
    .map((p) => p.en)
    .filter(Boolean)
    .join(separator.en),
});
const text = (doc: ResumeDoc, field: ResumeTextField): Pair => ({
  zh: doc.zh[field],
  en: doc.zh[field] ? doc.en[field] : "",
});

export function workRightsText(rights: WorkRights): Pair {
  const label = HELD_VISA_LABELS[rights.visa];
  return rights.weeklyHours == null
    ? label
    : {
        zh: `${label.zh}，每周可工作 ${rights.weeklyHours} 小时`,
        en: `${label.en}; may work up to ${rights.weeklyHours} hours a week`,
      };
}

/** The rows under the name, in print order; rows with nothing in Chinese are left out. */
export function resumeRows(doc: ResumeDoc): ResumeRow[] {
  const { facts } = doc;
  const hours = facts.hoursPerWeek && {
    zh: `每周 ${facts.hoursPerWeek.min}–${facts.hoursPerWeek.max} 小时`,
    en: `${facts.hoursPerWeek.min}–${facts.hoursPerWeek.max} hours a week`,
  };
  const types = join(
    facts.employmentTypes.map((type) => EMPLOYMENT_TYPE_LABELS[type]),
    { zh: "、", en: ", " },
  );
  const regions = join(
    facts.regionIds.flatMap((id) => {
      const region = regionById("NZ", id);
      return region ? [{ zh: region.nameZh, en: region.nameEn }] : [];
    }),
    { zh: "、", en: ", " },
  );
  const rows: [string, { zh: string; en: string }, Pair][] = [
    ["availability", TEXT_LABELS.availability, join([text(doc, "availability"), hours || EMPTY, types], DOT)],
    ["location", TEXT_LABELS.location, regions.zh ? regions : text(doc, "location")],
    [
      "pay",
      { zh: "期望时薪", en: "Expected pay" },
      facts.expectedMinPay == null
        ? EMPTY
        : { zh: `NZ$${facts.expectedMinPay} / 小时起`, en: `From NZ$${facts.expectedMinPay} an hour` },
    ],
    ["languages", TEXT_LABELS.languages, text(doc, "languages")],
    [
      "experience",
      { zh: "经验", en: "Experience" },
      facts.experienceYears == null ? EMPTY : years(facts.experienceYears),
    ],
    ["skills", TEXT_LABELS.skills, text(doc, "skills")],
    ["visa", { zh: "签证", en: "Work rights" }, doc.workRights ? workRightsText(doc.workRights) : EMPTY],
    ["bio", TEXT_LABELS.bio, text(doc, "bio")],
  ];
  return rows.flatMap(([id, label, value]) =>
    value.zh ? [{ id, zhLabel: label.zh, enLabel: label.en, zh: value.zh, en: value.en }] : [],
  );
}
const EMPTY: Pair = { zh: "", en: "" };
const DOT: Pair = { zh: " · ", en: " · " };

/**
 * The fields written in Chinese but not yet in English, in form order. The location needs no English when the
 * regions you can work in are chosen (they have English names).
 */
export function missingEnglish(doc: ResumeDoc): ResumeTextField[] {
  return RESUME_TEXT_FIELDS.filter(
    (field) => doc.zh[field] && !doc.en[field] && !(field === "location" && doc.facts.regionIds.length),
  );
}

/** The contact lines in print order. */
export function contactRows(
  contact: ResumeContact,
): { id: keyof ResumeContact; zh: string; en: string; value: string }[] {
  const labels = { phone: ["电话", "Phone"], wechat: ["微信", "WeChat"], email: ["邮箱", "Email"] } as const;
  return (["phone", "wechat", "email"] as const).flatMap((id) =>
    contact[id] ? [{ id, zh: labels[id][0], en: labels[id][1], value: contact[id]! }] : [],
  );
}
