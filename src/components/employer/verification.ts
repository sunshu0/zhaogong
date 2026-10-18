// 企业验证 by a person (#78, PRD R-16): the employer applies with a register entry and its own details; a moderator
// works through a checklist and approves or rejects with a reason. Pure: the employer page, /admin and the Server
// Functions share these rules and words. ADR 0011.
// The wording comes from the 企业验证 dictionary (Round 20, ADR 0023); the badge names from i18n/labels.ts. Every
// function that builds text takes the reader's language and falls back to Chinese, so /admin keeps working unchanged.
import { VERIFICATION_LABELS } from "@/i18n/labels";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerVerifyMessages } from "@/i18n/messages/employer-verify";
import type { EmployerVerification } from "@/lib/types";

/** The badge applied for: 已验证企业, or 认证雇主 (checked against Immigration New Zealand's public list). */
export type VerifyKind = Exclude<EmployerVerification, "unverified">;
export type RequestStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type RejectReason = "register_mismatch" | "phone_unreachable" | "impersonation" | "other";

const words = (lang: Lang) => pick(employerVerifyMessages, lang);

/** Why a moderator turned an application down, in the reader's language. */
export function rejectReasons(lang: Lang = DEFAULT_LANG): Record<RejectReason, string> {
  return words(lang).rejectReasons;
}

/** The Chinese reasons, for callers that have no language to hand. */
export const REJECT_REASONS: Record<RejectReason, string> = rejectReasons();

/** The badges one can apply for, named as the badge itself is (i18n/labels.ts). */
export function kindLabels(lang: Lang = DEFAULT_LANG): Record<VerifyKind, string> {
  return {
    business_verified: VERIFICATION_LABELS.business_verified[lang],
    accredited_employer: VERIFICATION_LABELS.accredited_employer[lang],
  };
}

/** The Chinese badge names, for callers that have no language to hand. */
export const KIND_LABELS: Record<VerifyKind, string> = kindLabels();

export type CheckId = "register" | "applicant" | "phone" | "website" | "accredited";

export interface CheckItem {
  id: CheckId;
  label: string;
  detail: string;
  /** Not every business has one: the moderator may leave it unticked. */
  optional?: boolean;
  links: { label: string; href: string }[];
}

export interface CheckResult {
  done: boolean;
  note?: string;
}
export type Checklist = Partial<Record<CheckId, CheckResult>>;

const COMPANIES_OFFICE = "https://app.companiesoffice.govt.nz/";
const NZBN_REGISTER = "https://www.nzbn.govt.nz/";
const ACCREDITED_LIST =
  "https://immigration.govt.nz/work/requirements-for-work-visas/approved-employers/accredited-employer-list";

/** What a moderator checks for one application, in order; the last only when 认证雇主 is applied for. */
export function checklistFor(
  request: { kind: VerifyKind; legalName: string; tradingName: string },
  lang: Lang = DEFAULT_LANG,
): CheckItem[] {
  const t = words(lang).checklist;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.tradingName)}`;
  const items: CheckItem[] = [
    {
      id: "register",
      label: t.register.label,
      detail: t.register.detail,
      links: [
        { label: t.register.nzbnLink, href: NZBN_REGISTER },
        { label: t.register.companiesOfficeLink, href: COMPANIES_OFFICE },
      ],
    },
    {
      id: "applicant",
      label: t.applicant.label,
      detail: t.applicant.detail,
      links: [{ label: t.applicant.directorsLink, href: COMPANIES_OFFICE }],
    },
    {
      id: "phone",
      label: t.phone.label,
      detail: t.phone.detail,
      links: [{ label: t.phone.mapsLink, href: maps }],
    },
    {
      id: "website",
      label: t.website.label,
      detail: t.website.detail,
      optional: true,
      links: [],
    },
  ];
  if (request.kind === "accredited_employer")
    items.push({
      id: "accredited",
      label: t.accredited.label,
      detail: t.accredited.detail,
      links: [{ label: t.accredited.listLink, href: ACCREDITED_LIST }],
    });
  return items;
}

const NOTE_MAX = 500;
const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/** Only the items of this application, each a tick and an optional note. */
export function sanitizeChecklist(input: unknown, items: readonly CheckItem[]): Checklist {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const checklist: Checklist = {};
  for (const { id } of items) {
    const entry = raw[id] && typeof raw[id] === "object" ? (raw[id] as Record<string, unknown>) : {};
    const note = clean(entry.note, NOTE_MAX);
    checklist[id] = { done: entry.done === true, ...(note && { note }) };
  }
  return checklist;
}

/** The items that must be ticked before 通过: every one but the optional. */
export function missingChecks(items: readonly CheckItem[], checklist: Checklist): CheckItem[] {
  return items.filter((item) => !item.optional && !checklist[item.id]?.done);
}

export type Rejection = { reason: RejectReason; note: string };

/** A rejection needs a reason and a note the employer can act on. */
export function parseRejection(
  reason: unknown,
  note: unknown,
  lang: Lang = DEFAULT_LANG,
): { ok: true; value: Rejection } | { ok: false; error_zh: string } {
  const t = words(lang).errors;
  if (typeof reason !== "string" || !(reason in REJECT_REASONS)) return { ok: false, error_zh: t.noRejectReason };
  const text = clean(note, NOTE_MAX);
  if (!text) return { ok: false, error_zh: t.noRejectNote };
  return { ok: true, value: { reason: reason as RejectReason, note: text } };
}

/** What the employer fills in besides the register entry. */
export interface VerifyApplication {
  nzbn: string;
  kind: VerifyKind;
  contactName: string;
  contactRole: string;
  companyPhone: string;
  website?: string;
}

const PHONE = /^\+?[\d\s()-]{6,20}$/;

/** The employer's form, checked on the server; the NZBN is normalised but looked up by the caller. */
export function parseApplication(
  input: unknown,
  lang: Lang = DEFAULT_LANG,
): { ok: true; value: VerifyApplication } | { ok: false; error_zh: string } {
  const t = words(lang).errors;
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const nzbn = clean(raw.nzbn, 30).replace(/[\s-]/g, "");
  const kind: VerifyKind = raw.kind === "accredited_employer" ? "accredited_employer" : "business_verified";
  const contactName = clean(raw.contactName, 40);
  const contactRole = clean(raw.contactRole, 40);
  const companyPhone = clean(raw.companyPhone, 20);
  const website = clean(raw.website, 200);
  if (!/^\d{13}$/.test(nzbn)) return { ok: false, error_zh: t.noBusinessChosen };
  if (!contactName) return { ok: false, error_zh: t.noContactName };
  if (!contactRole) return { ok: false, error_zh: t.noContactRole };
  if (!PHONE.test(companyPhone)) return { ok: false, error_zh: t.badPhone };
  if (website && !/^https?:\/\/\S+\.\S+/.test(website)) return { ok: false, error_zh: t.badWebsite };
  return { ok: true, value: { nzbn, kind, contactName, contactRole, companyPhone, ...(website && { website }) } };
}

/** Which badge an application would add: nothing when the business already has it or a higher one. */
export function canApplyFor(current: EmployerVerification, kind: VerifyKind): boolean {
  if (current === "accredited_employer") return false;
  return !(current === "business_verified" && kind === "business_verified");
}
