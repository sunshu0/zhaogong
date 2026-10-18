// The wording for external jobs (Round 18, ADR 0014), shared by the moderators' tab (#112) and the 实习 / 专业职位
// pages (#113). Every fact the posting does not state reads 「原文未说明」 / "Not stated": nothing is guessed (ADR 0014
// rule 4). The words are in the external dictionary (Round 20); the constants here are its Chinese side, for callers
// with no language to hand, and the functions take the reader's language (Chinese when left out).
import { formatDate } from "@/i18n/format";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { externalMessages } from "@/i18n/messages/external";
import type {
  DegreeLevel,
  DegreeSubject,
  ExternalCity,
  ExternalFacts,
  ExternalField,
  ExternalSource,
  ExternalFlag,
  ExternalKind,
  ExternalPay,
  VisaFact,
} from "@/lib/external-jobs/types";

/** The external dictionary in the reader's language. */
export const externalWords = (lang: Lang = DEFAULT_LANG) => pick(externalMessages, lang);

const zh = externalMessages.zh;

export const NOT_STATED = zh.notStated;

/** The applicant-tracking systems by their own names, for the moderators (#112, Ashby #138). */
export const SOURCE_NAMES: Record<ExternalSource, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
};

export const FIELD_LABELS: Record<ExternalField, string> = zh.fields;
export const KIND_LABELS: Record<ExternalKind, string> = zh.kinds;
export const CITY_LABELS: Record<ExternalCity, string> = zh.cities;
/** What the posting says, worded as the posting's statement, never as advice. */
export const VISA_LABELS: Record<VisaFact, string> = zh.visas;
export const DEGREE_LABELS: Record<DegreeLevel, string> = zh.degrees;
export const SUBJECT_LABELS: Record<DegreeSubject, string> = zh.subjects;
/** For moderators (#112): why a job needs a look before it can show. */
export const FLAG_LABELS: Record<ExternalFlag, string> = zh.flags;

/** 「10月17日」 / "17 Oct" in New Zealand time. */
export function dayLabel(iso: string, lang: Lang = DEFAULT_LANG): string {
  return formatDate(iso, lang, lang === "en" ? { day: "numeric", month: "short" } : { month: "long", day: "numeric" });
}

/** The closing date in full: 2026/10/18 / 18 Oct 2026. */
function fullDay(iso: string, lang: Lang): string {
  return lang === "en"
    ? formatDate(iso, "en", { dateStyle: "medium" })
    : formatDate(iso, "zh", { year: "numeric", month: "numeric", day: "numeric" });
}

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-NZ", { maximumFractionDigits: 2 })}`;

/** The posting's pay as it states it, in its own currency: 「$95,000–$110,000 NZD 每年」 / "… NZD a year". */
export function payLabel(pay: ExternalPay, lang: Lang = DEFAULT_LANG): string {
  const t = externalWords(lang).pay;
  const range = pay.maxCents ? `${money(pay.minCents)}–${money(pay.maxCents)}` : t.from(money(pay.minCents));
  return t.line(range, pay.currency, t[pay.period]);
}

export type FactsForLines = Pick<
  ExternalFacts,
  "field" | "kind" | "location" | "city" | "closesAt" | "minYears" | "degree" | "degreeSubjects" | "visa" | "pay"
>;

/** The facts as label and value rows, in the order the job page shows them. */
export function factLines(job: FactsForLines, lang: Lang = DEFAULT_LANG): { label: string; value: string }[] {
  const w = externalWords(lang);
  const t = w.facts;
  const degree = job.degree
    ? t.degreeWithSubjects(
        w.degrees[job.degree],
        job.degreeSubjects.map((s) => w.subjects[s]),
      )
    : w.notStated;
  return [
    { label: t.field, value: w.fields[job.field] },
    { label: t.kind, value: job.kind ? w.kinds[job.kind] : w.notStated },
    { label: t.place, value: t.placeValue(w.cities[job.city], job.location) },
    { label: t.closes, value: job.closesAt ? fullDay(job.closesAt, lang) : w.notStated },
    {
      label: t.experience,
      value: job.minYears == null ? w.notStated : job.minYears === 0 ? t.noExperience : t.years(job.minYears),
    },
    { label: t.degree, value: degree },
    { label: t.visa, value: job.visa.length ? t.visaList(job.visa.map((v) => w.visas[v])) : w.notStated },
    { label: t.pay, value: job.pay ? payLabel(job.pay, lang) : w.notStated },
  ];
}

/** 「外部职位 · 来自 XX 官网 · 信息取于 X月X日」: where it comes from and when it was read (Round 18 draft, 3.4). */
export function sourceLine(companyName: string, lastSeenAt: string, lang: Lang = DEFAULT_LANG): string {
  return externalWords(lang).source(companyName, dayLabel(lastSeenAt, lang));
}
