// The AI post page's progress: what the chat has filled, as one line that opens into a list. Each item
// says what to send to go back to it (改一下时薪 …), so a tap asks that question again.
import { COUNTRIES, regionById } from "@/config/countries";
import { VISA_LABELS } from "@/i18n/labels";
import { missingFields, type RequiredField } from "@/lib/ai-post";
import { checkJob, publishDecision, type JobDraft, type PostingEmployer } from "@/lib/compliance";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { CountryCode } from "@/lib/types";

export interface ChecklistItem {
  label: string;
  /** What is filled in; undefined while it is not. */
  value?: string;
  /** Needed before the job can be previewed. */
  required: boolean;
  /** Filled in (for a required item: every field behind it). */
  done: boolean;
  /** The message that takes the chat back to this item. */
  ask: string;
}

export interface Checklist {
  items: ChecklistItem[];
  /** Required items filled, of all required items. */
  done: number;
  total: number;
  /** Problems the checks found that hold publishing. */
  problems: number;
  ready: boolean;
}

const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const range = (r: { min: number; max?: number }, f: (n: number) => string = String) =>
  r.max != null && r.max !== r.min ? `${f(r.min)}–${f(r.max)}` : f(r.min);

function contactItem(draft: JobDraft): Draft {
  if (!draft.contactPublic)
    return { label: "联系方式", value: "不公开 · 聊天交换", required: false, ask: "公开联系方式" };
  const kinds = [draft.contact?.phone && "电话", draft.contact?.wechat && "微信", draft.contact?.email && "邮箱"]
    .filter(Boolean)
    .join("、");
  return {
    label: "联系方式",
    value: kinds ? `公开：${kinds}` : undefined,
    required: true,
    ask: "改一下联系方式",
    fields: ["contact"],
  };
}

function perksValue(draft: JobDraft): string | undefined {
  if (draft.mealsIncluded == null && draft.accommodationIncluded == null) return undefined;
  const perks = [draft.mealsIncluded && "包餐", draft.accommodationIncluded && "包住"].filter(Boolean).join("、");
  return perks || "不包吃住";
}

type Draft = Omit<ChecklistItem, "done"> & { fields?: RequiredField[] };

export function draftChecklist(draft: JobDraft, country: CountryCode, employer?: PostingEmployer): Checklist {
  const symbol = COUNTRIES[country].currencySymbol;
  const missing = missingFields(draft);
  const drafts: Draft[] = [
    {
      label: "职位名称",
      value: [draft.titleZh, draft.titleEn].filter(Boolean).join(" · ") || undefined,
      required: true,
      ask: "改一下职位名称",
      fields: ["titleZh", "titleEn", "industry"],
    },
    {
      label: "时薪",
      value: draft.pay && `${symbol}${range(draft.pay, money)}/小时`,
      required: true,
      ask: "改一下时薪",
      fields: ["pay"],
    },
    {
      label: "地区",
      value: draft.regionId && regionById(country, draft.regionId)?.nameZh,
      required: true,
      ask: "改一下地区",
      fields: ["regionId"],
    },
    {
      label: "工作类型",
      value: formatEmploymentTypes(draft.employmentType) || undefined,
      required: true,
      ask: "改一下工作类型",
      fields: ["employmentType"],
    },
    {
      label: "签证",
      value: draft.visaAccepted?.length ? draft.visaAccepted.map((v) => VISA_LABELS[v].zh).join("、") : undefined,
      required: true,
      ask: "改一下签证",
      fields: ["visaAccepted"],
    },
    { label: "职位描述", value: draft.descriptionZh, required: true, ask: "改一下描述", fields: ["descriptionZh"] },
    contactItem(draft),
    {
      label: "每周工时",
      value: draft.hoursPerWeek && `${range(draft.hoursPerWeek)} 小时`,
      required: false,
      ask: "改一下工时",
    },
    { label: "包餐包住", value: perksValue(draft), required: false, ask: "改一下包餐包住" },
  ];
  const items = drafts.map(({ fields = [], ...item }) => ({
    ...item,
    done: item.required ? !fields.some((f) => missing.includes(f)) : item.value != null,
  }));
  const required = items.filter((i) => i.required);
  const findings = checkJob(draft, country, employer);
  const problems = findings.filter((f) => f.level !== "review").length;
  return {
    items,
    done: required.filter((i) => i.done).length,
    total: required.length,
    problems,
    ready: publishDecision(findings).canPublish && missing.length === 0,
  };
}
