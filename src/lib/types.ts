// Shared domain types. Owned by the lead; lines A and B ask before changing them.

export type CountryCode = "NZ" | "AU";

export type Industry =
  | "hospitality" // 餐饮
  | "retail" // 零售
  | "beauty" // 美容美发
  | "construction" // 装修建筑
  | "cleaning" // 清洁
  | "logistics" // 物流仓储
  | "driver" // 司机
  | "office" // 文员行政
  | "other";

export type EmploymentType = "full_time" | "part_time" | "casual";

/** Which visa holders the employer says can do this job. Facts only, never visa advice. */
export type VisaAccepted =
  | "citizen_resident" // 公民 / 永居
  | "open_work" // 开放工签
  | "aewv" // 雇主担保工签（需认证雇主）
  | "student" // 学签（有打工限制）
  | "working_holiday"; // 打工度假

export type LanguageRequirement = "mandarin" | "cantonese" | "english";

export type EmployerVerification = "unverified" | "business_verified" | "accredited_employer";

export interface Employer {
  id: string;
  /** Trading name shown to job seekers. */
  name: string;
  /** Legal entity name from the business register, when verified. */
  legalName?: string;
  /** NZBN or ABN, when verified. */
  businessNumber?: string;
  verification: EmployerVerification;
  regionId: string;
  createdAt: string; // ISO date
}

export interface PayRange {
  /** Hourly rate in the country's currency. */
  min: number;
  max?: number;
}

export interface Job {
  id: string;
  country: CountryCode;
  employerId: string;
  /** Chinese title, e.g. 前厅服务员. */
  titleZh: string;
  titleEn: string;
  industry: Industry;
  employmentType: EmploymentType;
  regionId: string;
  /** Street-level address is optional; suburb comes from regionId. */
  address?: string;
  pay: PayRange;
  hoursPerWeek?: { min: number; max?: number };
  /** Free-text shift description, e.g. 周末晚班. */
  shiftsZh?: string;
  mealsIncluded: boolean;
  accommodationIncluded: boolean;
  visaAccepted: VisaAccepted[];
  languages: LanguageRequirement[];
  descriptionZh: string;
  descriptionEn: string;
  /** Shown only to signed-in users. */
  contact: { phone?: string; wechat?: string; email?: string };
  status: "active" | "expired" | "removed" | "pending_review";
  postedAt: string; // ISO datetime
  expiresAt: string; // ISO datetime
  urgent: boolean;
}

export interface JobFilter {
  country: CountryCode;
  regionIds?: string[];
  industries?: Industry[];
  employmentTypes?: EmploymentType[];
  minPay?: number;
  visa?: VisaAccepted;
  mealsIncluded?: boolean;
  accommodationIncluded?: boolean;
  query?: string;
}

export type ReportReason =
  | "fake_job"
  | "charges_fee" // 收押金 / 介绍费
  | "below_min_wage"
  | "discriminatory"
  | "visa_selling" // 卖工签
  | "inappropriate"
  | "other";

export interface Report {
  id: string;
  jobId: string;
  reason: ReportReason;
  note?: string;
  createdAt: string;
  status: "open" | "actioned" | "dismissed";
}
