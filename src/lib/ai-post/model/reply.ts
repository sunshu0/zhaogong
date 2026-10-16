// What the model hands back each turn (#102, ADR 0018): one JSON object, constrained by structured outputs, with the
// next thing to say, up to four quick replies and the draft fields it understood from the employer. The server still
// cleans the fields (sanitizeDraft) and runs the compliance rules on the result, so the schema only shapes the answer.
import { COUNTRIES } from "@/config/countries";
import { JOB_ROLE_IDS } from "@/config/job-roles";
import { EMPLOYMENT_TYPE_LABELS, INDUSTRY_LABELS, LANGUAGE_LABELS } from "@/i18n/labels";
import type { JobDraft } from "@/lib/compliance";
import type { CountryCode } from "@/lib/types";

/** Draft fields the model may fill. Flat, so the schema stays within structured outputs' 24 optional fields. */
export interface DraftPatch {
  titleZh?: string;
  titleEn?: string;
  industry?: string;
  roles?: string[];
  employmentType?: string[];
  regionId?: string;
  address?: string;
  payMin?: number;
  payMax?: number;
  hoursMin?: number;
  hoursMax?: number;
  shiftsZh?: string;
  mealsIncluded?: boolean;
  accommodationIncluded?: boolean;
  visaAccepted?: string[];
  languages?: string[];
  descriptionZh?: string;
  descriptionEn?: string;
  contactPublic?: boolean;
  phone?: string;
  wechat?: string;
  email?: string;
}

export interface ModelReply {
  reply: string;
  quickReplies: string[];
  draft: DraftPatch;
}

const text = (description: string) => ({ type: "string", description });
const list = (values: readonly string[], description: string) => ({
  type: "array",
  items: { type: "string", enum: [...values] },
  description,
});

/** The JSON schema for output_config.format. Built from the config in a fixed order, so it caches. */
export function replySchema(country: CountryCode) {
  const config = COUNTRIES[country];
  return {
    type: "object",
    properties: {
      reply: text("下一句要对雇主说的话：确认听懂了什么，然后只问一件还缺的事。简体中文，两三句以内。"),
      quickReplies: {
        type: "array",
        items: { type: "string" },
        description: "最多 4 个快捷回复，雇主点一下就当作他说了这句话。没有合适的就给空数组。",
      },
      draft: {
        type: "object",
        description: "这一轮从雇主的话里确定的职位字段。只写雇主说了或明确同意的，不知道的字段不要写。",
        properties: {
          titleZh: text("职位名称（中文）"),
          titleEn: text("职位名称（英文），雇主给了或同意了才写"),
          industry: { type: "string", enum: Object.keys(INDUSTRY_LABELS), description: "行业" },
          roles: list(JOB_ROLE_IDS, "岗位类别，最多 2 个"),
          employmentType: list(Object.keys(EMPLOYMENT_TYPE_LABELS), "工作类型，可多选"),
          regionId: { type: "string", enum: config.regions.map((r) => r.id), description: "地区" },
          address: text("具体地址，可不填"),
          payMin: { type: "number", description: `时薪下限（${config.currencySymbol}/小时）` },
          payMax: { type: "number", description: "时薪上限，没有就不写" },
          hoursMin: { type: "number", description: "每周最少小时" },
          hoursMax: { type: "number", description: "每周最多小时" },
          shiftsZh: text("班次和上班时间"),
          mealsIncluded: { type: "boolean", description: "包工作餐" },
          accommodationIncluded: { type: "boolean", description: "包住" },
          visaAccepted: list(config.visaTypes, "雇主接受的签证，只写雇主说的事实"),
          languages: list(Object.keys(LANGUAGE_LABELS), "语言要求"),
          descriptionZh: text("职位描述（中文），整理雇主说的内容，不编造"),
          descriptionEn: text("职位描述（英文），按中文描述翻译"),
          contactPublic: { type: "boolean", description: "雇主选择公开联系方式（true）还是在聊天里交换（false）" },
          phone: text("电话，只在公开联系方式时写"),
          wechat: text("微信，只在公开联系方式时写"),
          email: text("邮箱，只在公开联系方式时写"),
        },
        additionalProperties: false,
      },
    },
    required: ["reply", "quickReplies", "draft"],
    additionalProperties: false,
  };
}

/** The model's JSON text as a ModelReply, or undefined when it is not one (cut off, empty). */
export function readReply(json: string): ModelReply | undefined {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.reply !== "string" || !v.reply.trim()) return undefined;
  const quickReplies = Array.isArray(v.quickReplies)
    ? v.quickReplies.filter((q): q is string => typeof q === "string" && q.trim() !== "").slice(0, 4)
    : [];
  const draft = v.draft && typeof v.draft === "object" ? (v.draft as DraftPatch) : {};
  return { reply: v.reply.trim().slice(0, 1000), quickReplies, draft };
}

/**
 * The draft with the model's fields laid over it, in JobDraft's shape. Not yet clean: the caller passes it through
 * sanitizeDraft, which drops anything unknown, too long or of the wrong type.
 */
export function applyPatch(draft: JobDraft, patch: DraftPatch): Record<string, unknown> {
  const next: Record<string, unknown> = { ...draft };
  const plain = [
    "titleZh",
    "titleEn",
    "industry",
    "roles",
    "employmentType",
    "regionId",
    "address",
    "shiftsZh",
    "mealsIncluded",
    "accommodationIncluded",
    "visaAccepted",
    "languages",
    "descriptionZh",
    "descriptionEn",
    "contactPublic",
  ] as const;
  for (const key of plain) if (patch[key] !== undefined) next[key] = patch[key];
  if (patch.payMin !== undefined)
    next.pay = { min: patch.payMin, ...(patch.payMax !== undefined && { max: patch.payMax }) };
  if (patch.hoursMin !== undefined)
    next.hoursPerWeek = { min: patch.hoursMin, ...(patch.hoursMax !== undefined && { max: patch.hoursMax }) };
  if (patch.phone !== undefined || patch.wechat !== undefined || patch.email !== undefined)
    next.contact = {
      ...draft.contact,
      ...(patch.phone !== undefined && { phone: patch.phone }),
      ...(patch.wechat !== undefined && { wechat: patch.wechat }),
      ...(patch.email !== undefined && { email: patch.email }),
    };
  return next;
}
