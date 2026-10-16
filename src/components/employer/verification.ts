// 企业验证 by a person (#78, PRD R-16): the employer applies with a register entry and its own details; a moderator
// works through a checklist and approves or rejects with a reason. Pure: the employer page, /admin and the Server
// Functions share these rules and words. ADR 0011.
import type { EmployerVerification } from "@/lib/types";

/** The badge applied for: 已验证企业, or 认证雇主 (checked against Immigration New Zealand's public list). */
export type VerifyKind = Exclude<EmployerVerification, "unverified">;
export type RequestStatus = "pending" | "approved" | "rejected" | "withdrawn";
export type RejectReason = "register_mismatch" | "phone_unreachable" | "impersonation" | "other";

export const REJECT_REASONS: Record<RejectReason, string> = {
  register_mismatch: "登记信息对不上",
  phone_unreachable: "电话核实不到人",
  impersonation: "冒用他人公司",
  other: "其他",
};

export const KIND_LABELS: Record<VerifyKind, string> = {
  business_verified: "已验证企业",
  accredited_employer: "认证雇主",
};

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
export function checklistFor(request: { kind: VerifyKind; legalName: string; tradingName: string }): CheckItem[] {
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.tradingName)}`;
  const items: CheckItem[] = [
    {
      id: "register",
      label: "企业登记",
      detail: "这个 NZBN 在企业登记里是「已登记」，登记名和雇主填的公司名一致。",
      links: [
        { label: "去查 NZBN 登记", href: NZBN_REGISTER },
        { label: "去查 Companies Office", href: COMPANIES_OFFICE },
      ],
    },
    {
      id: "applicant",
      label: "申请人身份",
      detail: "申请人姓名在登记的董事或股东名单上；不在的，在下一步电话里确认他在公司的职务。",
      links: [{ label: "去查董事和股东", href: COMPANIES_OFFICE }],
    },
    {
      id: "phone",
      label: "电话核实",
      detail:
        "打公开渠道查到的公司电话（官网、Google 地图、登记信息），不打申请人填的号码，问一句「贵公司是否有这个人在找工发招聘」。",
      links: [{ label: "去 Google 地图查电话", href: maps }],
    },
    {
      id: "website",
      label: "网站或 Facebook",
      detail: "存在且是同一家店（地址、店名对得上）。没有就跳过。",
      optional: true,
      links: [],
    },
  ];
  if (request.kind === "accredited_employer")
    items.push({
      id: "accredited",
      label: "认证雇主名单",
      detail: "在移民局公开的认证雇主名单里，用 NZBN 或公司名查到这家公司，状态是有效。",
      links: [{ label: "去查认证雇主名单", href: ACCREDITED_LIST }],
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
): { ok: true; value: Rejection } | { ok: false; error_zh: string } {
  if (typeof reason !== "string" || !(reason in REJECT_REASONS)) return { ok: false, error_zh: "请选择驳回理由。" };
  const text = clean(note, NOTE_MAX);
  if (!text) return { ok: false, error_zh: "请写明驳回的说明，雇主会看到。" };
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
): { ok: true; value: VerifyApplication } | { ok: false; error_zh: string } {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const nzbn = clean(raw.nzbn, 30).replace(/[\s-]/g, "");
  const kind: VerifyKind = raw.kind === "accredited_employer" ? "accredited_employer" : "business_verified";
  const contactName = clean(raw.contactName, 40);
  const contactRole = clean(raw.contactRole, 40);
  const companyPhone = clean(raw.companyPhone, 20);
  const website = clean(raw.website, 200);
  if (!/^\d{13}$/.test(nzbn)) return { ok: false, error_zh: "请先在企业登记里选好你的公司。" };
  if (!contactName) return { ok: false, error_zh: "请填写联系人姓名。" };
  if (!contactRole) return { ok: false, error_zh: "请填写你在公司的职务。" };
  if (!PHONE.test(companyPhone)) return { ok: false, error_zh: "请填写公司电话（数字，可带 + 和空格）。" };
  if (website && !/^https?:\/\/\S+\.\S+/.test(website))
    return { ok: false, error_zh: "网站或 Facebook 请填完整的网址，以 http:// 或 https:// 开头。" };
  return { ok: true, value: { nzbn, kind, contactName, contactRole, companyPhone, ...(website && { website }) } };
}

/** Which badge an application would add: nothing when the business already has it or a higher one. */
export function canApplyFor(current: EmployerVerification, kind: VerifyKind): boolean {
  if (current === "accredited_employer") return false;
  return !(current === "business_verified" && kind === "business_verified");
}
