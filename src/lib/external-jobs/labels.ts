// Chinese wording for external jobs (Round 18, ADR 0014), shared by the moderators' tab (#112) and the 实习 / 专业职位
// pages (#113). Every fact the posting does not state reads 「原文未说明」: nothing is guessed (ADR 0014 rule 4).
import type {
  DegreeLevel,
  DegreeSubject,
  ExternalCity,
  ExternalFacts,
  ExternalField,
  ExternalFlag,
  ExternalKind,
  ExternalPay,
  VisaFact,
} from "@/lib/external-jobs/types";

export const NOT_STATED = "原文未说明";

export const FIELD_LABELS: Record<ExternalField, string> = { software: "软件", electrical: "电子电气" };

export const KIND_LABELS: Record<ExternalKind, string> = {
  internship: "实习",
  graduate: "毕业生项目",
  full_time: "全职",
  part_time: "兼职",
  contract: "合同",
};

export const CITY_LABELS: Record<ExternalCity, string> = {
  auckland: "奥克兰",
  wellington: "惠灵顿",
  christchurch: "基督城",
  hamilton: "汉密尔顿",
  dunedin: "但尼丁",
  nz_other: "新西兰其他地区",
};

/** What the posting says, worded as the posting's statement, never as advice. */
export const VISA_LABELS: Record<VisaFact, string> = {
  citizen_or_resident: "原文写明：需要公民或居民身份",
  work_rights: "原文写明：需要有在新西兰工作的权利",
  sponsorship: "原文写明：可以担保工作签证",
  no_sponsorship: "原文写明：不提供签证担保",
};

export const DEGREE_LABELS: Record<DegreeLevel, string> = { bachelor: "本科", master: "硕士", phd: "博士" };

export const SUBJECT_LABELS: Record<DegreeSubject, string> = {
  computer_science: "计算机科学",
  software_engineering: "软件工程",
  computer_engineering: "计算机工程",
  electrical_engineering: "电气工程",
  electronic_engineering: "电子工程",
  mechatronics: "机电一体化",
  information_technology: "信息技术",
  mathematics: "数学",
  physics: "物理",
};

/** For moderators (#112): why a job needs a look before it can show. */
export const FLAG_LABELS: Record<ExternalFlag, string> = {
  other_citizenship: "要求其他国家的公民身份（例如美国出口管制岗位要求 U.S. person）",
  ethnicity: "提到种族或民族方面的要求",
};

const day = new Intl.DateTimeFormat("en-NZ", { timeZone: "Pacific/Auckland", month: "numeric", day: "numeric" });
const fullDay = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Pacific/Auckland",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** 「10月17日」 in New Zealand time. */
export function dayLabel(iso: string): string {
  const parts = day.formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("month")}月${get("day")}日`;
}

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-NZ", { maximumFractionDigits: 2 })}`;

export function payLabel(pay: ExternalPay): string {
  const per = { year: "每年", month: "每月", hour: "每小时" }[pay.period];
  const range = pay.maxCents ? `${money(pay.minCents)}–${money(pay.maxCents)}` : `${money(pay.minCents)} 起`;
  return `${range} ${pay.currency} ${per}`;
}

export type FactsForLines = Pick<
  ExternalFacts,
  "field" | "kind" | "location" | "city" | "closesAt" | "minYears" | "degree" | "degreeSubjects" | "visa" | "pay"
>;

/** The facts as label and value rows, in the order the job page shows them. */
export function factLines(job: FactsForLines): { label: string; value: string }[] {
  const degree = job.degree
    ? `${DEGREE_LABELS[job.degree]}${job.degreeSubjects.length ? ` · ${job.degreeSubjects.map((s) => SUBJECT_LABELS[s]).join("、")}` : ""}`
    : NOT_STATED;
  return [
    { label: "领域", value: FIELD_LABELS[job.field] },
    { label: "类型", value: job.kind ? KIND_LABELS[job.kind] : NOT_STATED },
    { label: "地点", value: `${CITY_LABELS[job.city]}（原文：${job.location}）` },
    { label: "截止日期", value: job.closesAt ? fullDay.format(new Date(job.closesAt)) : NOT_STATED },
    {
      label: "经验",
      value: job.minYears == null ? NOT_STATED : job.minYears === 0 ? "不要求" : `${job.minYears} 年以上`,
    },
    { label: "学历", value: degree },
    { label: "签证", value: job.visa.length ? job.visa.map((v) => VISA_LABELS[v]).join("；") : NOT_STATED },
    { label: "薪资", value: job.pay ? payLabel(job.pay) : NOT_STATED },
  ];
}

/** 「外部职位 · 来自 XX 官网 · 信息取于 X月X日」: where it comes from and when it was read (Round 18 draft, 3.4). */
export function sourceLine(companyName: string, lastSeenAt: string): string {
  return `外部职位 · 来自 ${companyName} 官网 · 信息取于 ${dayLabel(lastSeenAt)}`;
}
