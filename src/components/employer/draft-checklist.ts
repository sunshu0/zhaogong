// The AI post page's progress: what the chat has filled, as one line that opens into a list. Each item
// says what to send to go back to it (改一下时薪 …), so a tap asks that question again. The 「改一下…」 messages
// go to the Chinese-only posting assistant, so they stay Chinese whatever the interface language is.
import { COUNTRIES, regionById } from "@/config/countries";
import { VISA_LABELS } from "@/i18n/labels";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { employerPostMessages } from "@/i18n/messages/employer-post";
import { missingFields, type RequiredField } from "@/lib/ai-post";
import { checkJob, publishDecision, type JobDraft, type PostingEmployer } from "@/lib/compliance";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { CountryCode } from "@/lib/types";

/** Which line of the list this is, whatever language its label is in. */
export type ChecklistKey =
  "title" | "pay" | "region" | "employmentType" | "visa" | "description" | "contact" | "hours" | "perks";

export interface ChecklistItem {
  key: ChecklistKey;
  label: string;
  /** What is filled in; undefined while it is not. */
  value?: string;
  /** Needed before the job can be previewed. */
  required: boolean;
  /** Filled in (for a required item: every field behind it). */
  done: boolean;
  /** The message that takes the chat back to this item (to the assistant, so always Chinese). */
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

type Words = ReturnType<typeof checklistWords>;
const checklistWords = (lang: Lang) => pick(employerPostMessages, lang).checklist;

const money = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
const range = (r: { min: number; max?: number }, f: (n: number) => string = String) =>
  r.max != null && r.max !== r.min ? `${f(r.min)}–${f(r.max)}` : f(r.min);

function contactItem(draft: JobDraft, t: Words): Draft {
  if (!draft.contactPublic)
    return { key: "contact", label: t.contactLabel, value: t.contactPrivate, required: false, ask: "公开联系方式" };
  const kinds = [
    draft.contact?.phone && t.contactPhone,
    draft.contact?.wechat && t.contactWechat,
    draft.contact?.email && t.contactEmail,
  ]
    .filter(Boolean)
    .join(t.separator);
  return {
    key: "contact",
    label: t.contactLabel,
    value: kinds ? t.contactPublic(kinds) : undefined,
    required: true,
    ask: "改一下联系方式",
    fields: ["contact"],
  };
}

function perksValue(draft: JobDraft, t: Words): string | undefined {
  if (draft.mealsIncluded == null && draft.accommodationIncluded == null) return undefined;
  const perks = [draft.mealsIncluded && t.meals, draft.accommodationIncluded && t.accommodation]
    .filter(Boolean)
    .join(t.separator);
  return perks || t.noPerks;
}

type Draft = Omit<ChecklistItem, "done"> & { fields?: RequiredField[] };

export function draftChecklist(
  draft: JobDraft,
  country: CountryCode,
  employer?: PostingEmployer,
  lang: Lang = DEFAULT_LANG,
): Checklist {
  const t = checklistWords(lang);
  const symbol = COUNTRIES[country].currencySymbol;
  const missing = missingFields(draft);
  const region = draft.regionId ? regionById(country, draft.regionId) : undefined;
  const drafts: Draft[] = [
    {
      key: "title",
      label: t.titleLabel,
      value: [draft.titleZh, draft.titleEn].filter(Boolean).join(" · ") || undefined,
      required: true,
      ask: "改一下职位名称",
      fields: ["titleZh", "titleEn", "industry"],
    },
    {
      key: "pay",
      label: t.payLabel,
      value: draft.pay && t.payValue(`${symbol}${range(draft.pay, money)}`),
      required: true,
      ask: "改一下时薪",
      fields: ["pay"],
    },
    {
      key: "region",
      label: t.regionLabel,
      value: region && (lang === "en" ? region.nameEn : region.nameZh),
      required: true,
      ask: "改一下地区",
      fields: ["regionId"],
    },
    {
      key: "employmentType",
      label: t.employmentTypeLabel,
      value: formatEmploymentTypes(draft.employmentType, lang) || undefined,
      required: true,
      ask: "改一下工作类型",
      fields: ["employmentType"],
    },
    {
      key: "visa",
      label: t.visaLabel,
      value: draft.visaAccepted?.length
        ? draft.visaAccepted.map((v) => VISA_LABELS[v][lang]).join(t.separator)
        : undefined,
      required: true,
      ask: "改一下签证",
      fields: ["visaAccepted"],
    },
    {
      key: "description",
      label: t.descriptionLabel,
      value: draft.descriptionZh,
      required: true,
      ask: "改一下描述",
      fields: ["descriptionZh"],
    },
    contactItem(draft, t),
    {
      key: "hours",
      label: t.hoursLabel,
      value: draft.hoursPerWeek && t.hoursValue(range(draft.hoursPerWeek)),
      required: false,
      ask: "改一下工时",
    },
    { key: "perks", label: t.perksLabel, value: perksValue(draft, t), required: false, ask: "改一下包餐包住" },
  ];
  const items = drafts.map(({ fields = [], ...item }) => ({
    ...item,
    done: item.required ? !fields.some((f) => missing.includes(f)) : item.value != null,
  }));
  const required = items.filter((i) => i.required);
  const findings = checkJob(draft, country, employer, lang);
  const problems = findings.filter((f) => f.level !== "review").length;
  return {
    items,
    done: required.filter((i) => i.done).length,
    total: required.length,
    problems,
    ready: publishDecision(findings).canPublish && missing.length === 0,
  };
}
