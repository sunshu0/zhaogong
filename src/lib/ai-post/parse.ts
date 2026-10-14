// "AI" job-post generator, stage one: a deterministic parser behind the interface a model call
// will have later. parsePost is async on purpose; replace its body, keep its signature and result.
import { COUNTRIES, regionById } from "@/config/countries";
import type { JobDraft } from "@/lib/compliance";
import { LANGUAGE_LABELS, VISA_LABELS } from "@/i18n/labels";
import { formatEmploymentTypes, normalizeEmploymentTypes } from "@/lib/employment-types";
import type { CountryCode, EmploymentType, Industry, Job, VisaAccepted } from "@/lib/types";
import { INDUSTRY_WORDS, LANGUAGE_WORDS, REGION_ALIASES, TITLES, VISA_WORDS, type TitleEntry } from "./vocabulary";

/** Fields a job needs before it can be published, in the order the form shows them. */
export const REQUIRED_FIELDS = [
  "titleZh",
  "titleEn",
  "industry",
  "employmentType",
  "pay",
  "regionId",
  "visaAccepted",
  "contact",
  "descriptionZh",
  "descriptionEn",
] as const satisfies readonly (keyof JobDraft)[];

export type RequiredField = (typeof REQUIRED_FIELDS)[number];

export interface ParsedPost {
  draft: JobDraft;
  /** Required fields the text did not give, for the form to highlight. */
  missing: RequiredField[];
  /** Things the employer should know about the result, e.g. a weekly wage that needs an hourly rate. */
  notes_zh: string[];
}

/** Turn a pasted message or free text into a job draft. */
export async function parsePost(text: string, country: CountryCode): Promise<ParsedPost> {
  return parseText(text, country);
}

export function missingFields(draft: JobDraft): RequiredField[] {
  return REQUIRED_FIELDS.filter((field) => {
    const value = draft[field];
    if (value == null) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) return value.length === 0;
    if (field === "contact") return !Object.values(value).some((v) => typeof v === "string" && v.trim());
    return false;
  });
}

const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const range = (r: { min: number; max?: number }, f: (n: number) => string = String) =>
  r.max != null && r.max !== r.min ? `${f(r.min)}–${f(r.max)}` : f(r.min);

/** An English description built from the structured fields, for the employer to edit. */
export function englishSummary(draft: JobDraft, country: CountryCode): string {
  const sentences: string[] = [];

  const type = formatEmploymentTypes(draft.employmentType, "en");
  const title = draft.titleEn && (type ? draft.titleEn[0].toLowerCase() + draft.titleEn.slice(1) : draft.titleEn);
  const region = draft.regionId && regionById(country, draft.regionId);
  const what = [type, title].filter(Boolean).join(" ") || "Job";
  sentences.push(`${what}${region ? ` in ${region.nameEn}` : ""}.`);

  const terms: string[] = [];
  if (draft.pay) terms.push(`${COUNTRIES[country].currencySymbol}${range(draft.pay, money)} an hour`);
  if (draft.hoursPerWeek) terms.push(`${range(draft.hoursPerWeek)} hours a week`);
  if (terms.length) sentences.push(`${terms.join(", ")}.`);

  if (draft.mealsIncluded && draft.accommodationIncluded) sentences.push("Meals and accommodation included.");
  else if (draft.mealsIncluded) sentences.push("Meals included.");
  else if (draft.accommodationIncluded) sentences.push("Accommodation included.");

  if (draft.languages?.length)
    sentences.push(`Languages: ${draft.languages.map((l) => LANGUAGE_LABELS[l].en).join(", ")}.`);
  if (draft.visaAccepted?.length)
    sentences.push(`Visas accepted: ${draft.visaAccepted.map((v) => VISA_LABELS[v].en).join(", ")}.`);

  return sentences.join(" ");
}

// ---- the stub itself ----

const isLatin = (word: string) => /^[\x20-\x7e]+$/.test(word);
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Positions of a word in lower-case text; English words only as whole words. */
function positions(text: string, word: string): number[] {
  const pattern = new RegExp(isLatin(word) ? `\\b${escapeRegExp(word)}\\b` : escapeRegExp(word), "g");
  return [...text.matchAll(pattern)].map((m) => m.index ?? 0);
}

const NEGATED_BEFORE = /(不|无|没有|拒绝)(需要|需|用|要求|接受|要|收|会)*\s*$|\b(no|not|non)\s+$/;
const NEGATED_AFTER = /^\s*(勿扰|不行|不可|免谈|不要|不接受|not\b)/;

/** First place a word appears that is not negated (不需要英语, 学签勿扰), or -1. */
function firstMention(text: string, words: string[]): number {
  let best = -1;
  for (const word of words) {
    for (const at of positions(text, word)) {
      const negated =
        NEGATED_BEFORE.test(text.slice(Math.max(0, at - 6), at)) ||
        NEGATED_AFTER.test(text.slice(at + word.length, at + word.length + 4));
      if (!negated && (best < 0 || at < best)) best = at;
    }
  }
  return best;
}

const TITLES_BY_LENGTH = [...TITLES].sort((a, b) => b.zh.length - a.zh.length);
const HIRE = /(高薪诚聘|急招|急聘|诚聘|招聘|聘请|招)/g;
const TITLE_END = /[，,。！!\s【】()（）:：;；/、\d]/;
const LEADING_TYPE = /^(全职|兼职|临时|长期|短期)+/;
const HEAD_COUNT = /([一两二三四五六七八九十若数多几]+|\d+)?(名|位|个|人)$|若干$/;

function findTitle(text: string, lower: string): { zh?: string; entry?: TitleEntry } {
  let fallback: string | undefined;
  for (const m of text.matchAll(HIRE)) {
    const rest = text.slice((m.index ?? 0) + m[0].length);
    const end = rest.search(TITLE_END);
    const candidate = (end < 0 ? rest : rest.slice(0, end)).replace(LEADING_TYPE, "").replace(HEAD_COUNT, "");
    if (!/^[\u4e00-\u9fff]{2,10}$/.test(candidate)) continue;
    const entry = TITLES_BY_LENGTH.find((t) => candidate.includes(t.zh));
    if (entry) return { zh: candidate, entry };
    fallback ??= candidate;
  }
  if (fallback) return { zh: fallback };
  // No 招 / 聘: look for a known job anywhere, Chinese first, then English.
  const zh = TITLES_BY_LENGTH.find((t) => text.includes(t.zh));
  if (zh) return { zh: zh.zh, entry: zh };
  const en = TITLES_BY_LENGTH.find((t) => t.enAliases?.some((a) => positions(lower, a).length));
  return en ? { zh: en.zh, entry: en } : {};
}

const NUM = String.raw`(?<!\d)(\d{2,3}(?:\.\d{1,2})?)(?!\d)`;
const NUM2 = String.raw`(?:\s*(?:-|~|–|—|到|至)\s*\$?\s*(\d{2,3}(?:\.\d{1,2})?)(?!\d))?`;
const PAY_PREFIX = new RegExp(
  String.raw`(?:时薪|小时工资|工资|薪水|薪资|每小时|hourly rate|hourly|pay rate)\s*[:：]?\s*(?:nz)?\$?\s*` + NUM + NUM2,
);
const PAY_SUFFIX = new RegExp(
  String.raw`(?:nz)?\$?\s*` +
    NUM +
    NUM2 +
    String.raw`\s*(?:纽币|纽元|刀|元|nzd|dollars?)?\s*(?:/\s*(?:小时|(?:hour|hr|h)\b)|每小时|一个?小时|(?:per|an)\s+hour|p/?h\b)`,
);
const OTHER_PERIOD_PAY = /(周薪|年薪|月薪|salary|per annum|per year|a year)/;

function findPay(lower: string): Job["pay"] | undefined {
  const hits = [PAY_PREFIX.exec(lower), PAY_SUFFIX.exec(lower)].filter((m) => m != null);
  const m = hits.sort((a, b) => a.index - b.index)[0];
  if (!m) return undefined;
  const a = Number(m[1]);
  const b = m[2] != null ? Number(m[2]) : undefined;
  const [min, max] = b != null && b < a ? [b, a] : [a, b];
  if (min < 10 || min > 200) return undefined;
  return max != null && max !== min ? { min, max } : { min };
}

const HOURS_ZH =
  /(?:每周|一周|每星期)(?:工作)?\s*(?:约|大约)?\s*(\d{1,2})(?:\s*(?:-|~|–|—|到|至)\s*(\d{1,2}))?\s*个?\s*(?:小时|hours?|hrs?|h\b)/;
const HOURS_PER_WEEK =
  /(?<!\d)(\d{1,2})(?:\s*(?:-|~|–|—|到|至)\s*(\d{1,2}))?\s*(?:小时|hours?|hrs?|h)\s*(?:\/|每|一|per|a)\s*(?:周|week|wk)/;

function findHours(lower: string): Job["hoursPerWeek"] {
  const m = HOURS_ZH.exec(lower) ?? HOURS_PER_WEEK.exec(lower);
  if (!m) return undefined;
  const min = Number(m[1]);
  const max = m[2] != null ? Number(m[2]) : undefined;
  if (min < 1 || min > 80) return undefined;
  return max != null && max > min ? { min, max } : { min };
}

const EMPLOYMENT_WORDS: [EmploymentType, RegExp][] = [
  ["full_time", /全职|full[\s-]?time/],
  ["part_time", /兼职|part[\s-]?time/],
  ["casual", /临时工|临时|短期|零工|casual/],
];

function findEmploymentType(lower: string, hours: Job["hoursPerWeek"]): Job["employmentType"] | undefined {
  const found = EMPLOYMENT_WORDS.filter(([, re]) =>
    [...lower.matchAll(new RegExp(re.source, "g"))].some((match) => {
      const at = match.index;
      return (
        !NEGATED_BEFORE.test(lower.slice(Math.max(0, at - 6), at)) &&
        !NEGATED_AFTER.test(lower.slice(at + match[0].length))
      );
    }),
  ).map(([type]) => type);
  if (found.length) return normalizeEmploymentTypes(found);
  // An explicit exclusion must not become an inferred choice from hours.
  if (EMPLOYMENT_WORDS.some(([, re]) => re.test(lower))) return undefined;
  // No word for it: guess from the hours, the employer can change it in the form.
  if (hours && (hours.max ?? hours.min) <= 30) return ["part_time"];
  if (hours && hours.min >= 35) return ["full_time"];
  return undefined;
}

function findRegion(lower: string, country: CountryCode): string | undefined {
  const text = lower.replace(/\bmount\s+/g, "mt ").replace(/\bmt\.\s*/g, "mt ");
  const generic = new Set(["west", "south", "east", "north"]);
  let best: { id: string; at: number } | undefined;
  for (const region of COUNTRIES[country].regions) {
    const names = [...region.nameZh.split("/"), ...region.nameEn.split("/")]
      .map((n) =>
        n
          .trim()
          .toLowerCase()
          .replace(/^auckland\s+/, ""),
      )
      .filter((n) => n && !generic.has(n));
    for (const name of [...names, ...(REGION_ALIASES[region.id] ?? [])]) {
      const at = positions(text, name)[0];
      if (at != null && (!best || at < best.at)) best = { id: region.id, at };
    }
  }
  return best?.id;
}

function findIncluded(lower: string, yes: RegExp, no: RegExp): boolean | undefined {
  if (no.test(lower)) return false;
  if (yes.test(lower)) return true;
  return undefined;
}

const MEALS =
  /包(吃住|吃|餐|工作餐|员工餐|一餐|两餐|二餐|三餐)|提供(工作|员工)?餐|员工餐|管饭|meals? (provided|included)/;
const NO_MEALS = /不包(吃|餐)|餐自理|不提供(工作|员工)?餐/;
const ACCOMMODATION = /包(吃)?住|包宿|提供住宿|员工宿舍|accommodation (provided|included)/;
const NO_ACCOMMODATION = /不包(吃)?住|住宿自理|不提供住宿/;
const URGENT = /急招|急聘|急需|马上上班|即刻上班|尽快上班|urgent|asap|immediate start/;
const SHIFT = /早班|晚班|夜班|白班|中班|周末|周[一二三四五六日天](至|到|-|~|—)周[一二三四五六日天]|工作日/;

const PHONE = /(?<!\d)(?:\+?64[\s-]?|0)(?:2\d|[3-9])[\s-]?\d{3}[\s-]?\d{3,4}(?!\d)/;
const WECHAT = /(?:微信号?|(?<![a-z])(?:vx|wx|wechat(?:\s*id)?)|v信|威信|加v|加微)\s*[:：]?\s*([a-z][-_a-z0-9]{5,19})/i;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const CLAUSE_END = /([，,。；;！!]|\.\s)/;

/** The original text without the clauses that carry contact details: those are shown only after sign-in. */
function describe(original: string, contactValues: string[]): string {
  return original
    .split("\n")
    .map((line) => {
      const parts = line.split(CLAUSE_END);
      let out = "";
      for (let i = 0; i < parts.length; i += 2) {
        const clause = parts[i];
        const normal = clause.normalize("NFKC");
        if (contactValues.some((v) => normal.includes(v))) continue;
        out += clause + (parts[i + 1] ?? "");
      }
      return out.trim().replace(/[，,；;]+$/, "");
    })
    .filter(Boolean)
    .join("\n");
}

function parseText(raw: string, country: CountryCode): ParsedPost {
  // Read the normalized text (full-width digits and letters folded), but copy shifts and the
  // description from what the employer wrote: NFKC would also turn ， into ,.
  const original = raw.trim();
  const text = original.normalize("NFKC");
  const draft: JobDraft = { country };
  const notes_zh: string[] = [];
  if (!text) return { draft, missing: missingFields(draft), notes_zh };
  const lower = text.toLowerCase();

  const title = findTitle(text, lower);
  if (title.zh) draft.titleZh = title.zh;
  if (title.entry) draft.titleEn = title.entry.en;
  const industry =
    title.entry?.industry ?? INDUSTRY_WORDS.find(([, words]) => words.some((w) => positions(lower, w).length))?.[0];
  if (industry) draft.industry = industry;

  const pay = findPay(lower);
  if (pay) draft.pay = pay;
  else if (OTHER_PERIOD_PAY.test(lower)) notes_zh.push("原文写的是周薪、月薪或年薪，请换算成时薪填写。");
  const hours = findHours(lower);
  if (hours) draft.hoursPerWeek = hours;
  const employmentType = findEmploymentType(lower, hours);
  if (employmentType) draft.employmentType = employmentType;

  const regionId = findRegion(lower, country);
  if (regionId) draft.regionId = regionId;
  const shift = original
    .split(/[，,。；;！!\n]/)
    .map((c) => c.trim())
    .find((c) => SHIFT.test(c) && c.length <= 20);
  if (shift) draft.shiftsZh = shift;

  const meals = findIncluded(lower, MEALS, NO_MEALS);
  if (meals != null) draft.mealsIncluded = meals;
  const accommodation = findIncluded(lower, ACCOMMODATION, NO_ACCOMMODATION);
  if (accommodation != null) draft.accommodationIncluded = accommodation;

  draft.visaAccepted = VISA_WORDS.filter(([, words]) => firstMention(lower, words) >= 0).map(([visa]) => visa);
  draft.languages = LANGUAGE_WORDS.filter(([, words]) => firstMention(lower, words) >= 0).map(([lang]) => lang);
  if (URGENT.test(lower)) draft.urgent = true;

  const phone = PHONE.exec(text)?.[0];
  const wechat = WECHAT.exec(text)?.[1];
  const email = EMAIL.exec(text)?.[0];
  draft.contact = { ...(phone && { phone }), ...(wechat && { wechat }), ...(email && { email }) };

  draft.descriptionZh = describe(
    original,
    [phone, wechat, email].filter((v) => v != null),
  );
  draft.descriptionEn = englishSummary(draft, country);

  return { draft, missing: missingFields(draft), notes_zh };
}

// ---- one field at a time: the chat (chat.ts) asks one question per turn and reads short answers ----

const lowerOf = (text: string) => text.normalize("NFKC").toLowerCase();

/** A job title from an answer like 厨房帮工, 招洗碗工两名 or a title the vocabulary does not know (水电工). */
export function readTitle(text: string): { titleZh?: string; titleEn?: string; industry?: Industry } {
  const t = text.normalize("NFKC").trim();
  const found = findTitle(t, t.toLowerCase());
  const bare = t.replace(/^(招聘|招)/, "").replace(HEAD_COUNT, "");
  const zh = found.zh ?? (/^[\u4e00-\u9fff]{2,10}$/.test(bare) ? bare : undefined);
  const entry = found.entry ?? (zh ? TITLES_BY_LENGTH.find((e) => zh.includes(e.zh)) : undefined);
  return { titleZh: zh, titleEn: entry?.en, industry: entry?.industry };
}

/** The employment type only when the text says it (no guessing from hours). */
export function readEmploymentType(text: string): Job["employmentType"] | undefined {
  return findEmploymentType(lowerOf(text), undefined);
}

export function readRegion(text: string, country: CountryCode): string | undefined {
  return findRegion(lowerOf(text), country);
}

/** Visas named in the text, not negated (不要学签 names none), in the usual order. */
export function readVisas(text: string): VisaAccepted[] {
  const lower = lowerOf(text);
  return VISA_WORDS.filter(([, words]) => firstMention(lower, words) >= 0).map(([visa]) => visa);
}

export function readPerks(text: string): { mealsIncluded?: boolean; accommodationIncluded?: boolean } {
  const lower = lowerOf(text);
  return {
    mealsIncluded: findIncluded(lower, MEALS, NO_MEALS),
    accommodationIncluded: findIncluded(lower, ACCOMMODATION, NO_ACCOMMODATION),
  };
}

export function readContact(text: string): Job["contact"] {
  const t = text.normalize("NFKC");
  const phone = PHONE.exec(t)?.[0];
  const wechat = WECHAT.exec(t)?.[1];
  const email = EMAIL.exec(t)?.[0];
  return { ...(phone && { phone }), ...(wechat && { wechat }), ...(email && { email }) };
}
