// Display labels for shared enums. Chinese first; English is shown alongside where useful.
import type {
  EmployerVerification,
  EmploymentType,
  Industry,
  LanguageRequirement,
  ReportReason,
  VisaAccepted,
} from "@/lib/types";

export const INDUSTRY_LABELS: Record<Industry, { zh: string; en: string }> = {
  hospitality: { zh: "餐饮", en: "Hospitality" },
  retail: { zh: "零售", en: "Retail" },
  beauty: { zh: "美容美发", en: "Beauty" },
  construction: { zh: "装修建筑", en: "Construction" },
  cleaning: { zh: "清洁", en: "Cleaning" },
  logistics: { zh: "物流仓储", en: "Logistics" },
  driver: { zh: "司机", en: "Driver" },
  office: { zh: "文员行政", en: "Office" },
  other: { zh: "其他", en: "Other" },
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, { zh: string; en: string }> = {
  full_time: { zh: "全职", en: "Full-time" },
  part_time: { zh: "兼职", en: "Part-time" },
  casual: { zh: "临时工", en: "Casual" },
};

export const VISA_LABELS: Record<VisaAccepted, { zh: string; en: string }> = {
  citizen_resident: { zh: "公民 / 永居", en: "Citizen / Resident" },
  open_work: { zh: "开放工签", en: "Open work visa" },
  aewv: { zh: "持 AEWV 工签者", en: "AEWV" },
  student: { zh: "学签", en: "Student visa" },
  working_holiday: { zh: "打工度假", en: "Working holiday" },
};

export const LANGUAGE_LABELS: Record<LanguageRequirement, { zh: string; en: string }> = {
  mandarin: { zh: "普通话", en: "Mandarin" },
  cantonese: { zh: "粤语", en: "Cantonese" },
  english: { zh: "英语", en: "English" },
};

export const VERIFICATION_LABELS: Record<EmployerVerification, { zh: string; en: string }> = {
  unverified: { zh: "未验证", en: "Unverified" },
  business_verified: { zh: "已验证企业", en: "Verified business" },
  accredited_employer: { zh: "认证雇主", en: "Accredited employer" },
};

export const REPORT_REASON_LABELS: Record<ReportReason, { zh: string; en: string }> = {
  fake_job: { zh: "虚假职位", en: "Fake job" },
  charges_fee: { zh: "收押金 / 介绍费", en: "Charges a fee" },
  below_min_wage: { zh: "低于最低工资", en: "Below minimum wage" },
  discriminatory: { zh: "歧视性内容", en: "Discriminatory" },
  visa_selling: { zh: "卖工签 / 包签", en: "Selling visas" },
  inappropriate: { zh: "不当内容", en: "Inappropriate" },
  other: { zh: "其他", en: "Other" },
};

export const PRODUCT_NAME = "找工"; // working name, pending a decision
