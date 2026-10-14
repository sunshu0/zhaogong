// Text helpers for the chat: cutting sentences, reading numbers, and saying what the draft holds.
import { COUNTRIES, regionById } from "@/config/countries";
import { VISA_LABELS } from "@/i18n/labels";
import type { JobDraft } from "@/lib/compliance";
import { formatEmploymentTypes } from "@/lib/employment-types";
import { readTitle } from "./parse";
import type { ChatState } from "./chat-state";

export const CLAUSE = /([，,。；;！!\n])/;
export const PAY_CLAUSE = /时薪|工资|薪水|薪资|\$\s*\d|\d+\s*(刀|纽币)|\/\s*(小时|h\b)/i;
export const compact = (s: string) =>
  s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s*·•._~|\\/-]+/g, "");

/** The text without the sentences that hold any of `words` (or match `pattern`). */
export function removeClauses(text: string, words: string[], pattern?: RegExp): string {
  const parts = text.split(CLAUSE);
  let out = "";
  for (let i = 0; i < parts.length; i += 2) {
    const clause = parts[i];
    const hit = words.some((w) => compact(clause).includes(compact(w))) || (pattern?.test(clause) ?? false);
    if (!hit) out += clause + (parts[i + 1] ?? "");
  }
  return out
    .replace(/^[，,。；;！!\s]+/, "")
    .replace(/[，,；;\s]+$/, "")
    .replace(/([，,])([。！!])/g, "$2");
}

export function replaceWords(text: string, words: string[], by: string): string {
  let out = text;
  for (const w of words) out = out.split(w).join(by);
  return out === text ? `${removeClauses(text, words)}${removeClauses(text, words) ? "，" : ""}${by}` : out;
}

export function numbers(text: string): number[] {
  return [...text.normalize("NFKC").matchAll(/\d+(?:\.\d{1,2})?/g)].map((m) => Number(m[0]));
}

export function titleFields(text: string): Partial<JobDraft> {
  const t = readTitle(text);
  return { titleZh: t.titleZh ?? text, titleEn: t.titleEn, ...(t.industry && { industry: t.industry }) };
}

export const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
export const range = (r: { min: number; max?: number }, f: (n: number) => string = String) =>
  r.max != null && r.max !== r.min ? `${f(r.min)}–${f(r.max)}` : f(r.min);

export function payText(s: ChatState): string {
  return s.draft.pay ? `${COUNTRIES[s.country].currencySymbol}${range(s.draft.pay, money)}/小时` : "";
}

export function perksText(d: JobDraft): string {
  if (d.mealsIncluded && d.accommodationIncluded) return "包吃住";
  if (d.mealsIncluded) return "包餐";
  if (d.accommodationIncluded) return "包住";
  return "不包吃住";
}

export const contactKinds = (d: JobDraft) =>
  [d.contact?.phone && "电话", d.contact?.wechat && "微信", d.contact?.email && "邮箱"].filter(Boolean).join("、");

/** The employer's contact choice in one line, with how to change it (private unless they made it public). */
export function contactChoice(d: JobDraft): string {
  const kinds = contactKinds(d);
  if (d.contactPublic) return `联系方式公开：登录的求职者能在职位页看到你的${kinds}。`;
  const given = kinds ? `你写的${kinds}不会显示，` : "";
  return `联系方式不公开：${given}求职者在聊天里申请交换，你同意后才给。交换用的资料在企业主页填写。想公开就点「公开联系方式」。`;
}

/** What the draft says so far, in one line. */
export function summary(d: JobDraft): string {
  const country = d.country ?? "NZ";
  return [
    d.titleZh,
    d.pay && `${COUNTRIES[country].currencySymbol}${range(d.pay, money)}/小时`,
    d.regionId && regionById(country, d.regionId)?.nameZh,
    formatEmploymentTypes(d.employmentType),
    d.hoursPerWeek && `每周 ${range(d.hoursPerWeek)} 小时`,
    (d.mealsIncluded != null || d.accommodationIncluded != null) && perksText(d),
    d.visaAccepted?.length && `签证：${d.visaAccepted.map((v) => VISA_LABELS[v].zh).join("、")}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
