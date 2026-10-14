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
  /** Set when moderation bans the employer; their jobs are taken down too. */
  bannedAt?: string;
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
  /** Every form of employment the job accepts, in the usual order (全职, 兼职, 临时工). */
  employmentType: EmploymentType[];
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
  /**
   * The employer's choice: true shows `contact` to signed-in job seekers on the job page; false
   * (the default) means details are only swapped in chat once both sides agree.
   */
  contactPublic: boolean;
  /** Shown only to signed-in users, and only when `contactPublic` is true. */
  contact: { phone?: string; wechat?: string; email?: string };
  status: "active" | "expired" | "removed" | "pending_review";
  postedAt: string; // ISO datetime
  expiresAt: string; // ISO datetime
  urgent: boolean;
  /** People the employer says they hired through this job, confirmed when closing it. */
  hiresConfirmed?: number;
  hiresConfirmedAt?: string; // ISO datetime
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

/** A signed-in job seeker revealed a job's contact details. */
export interface ContactView {
  jobId: string;
  /** Demo identity; the real backend will use a user id from the session. */
  viewerEmail: string;
  viewedAt: string;
}

export type ModerationAction = "approve" | "take_down" | "dismiss" | "ban";

/** One moderation decision, kept for complaints and audits. */
export interface ModerationLogEntry {
  id: string;
  at: string; // ISO datetime
  action: ModerationAction;
  jobId?: string;
  jobTitle?: string;
  employerId?: string;
  employerName?: string;
  /** Report reasons behind the action, when it came from reports. */
  reasons?: ReportReason[];
  /** Compliance rule ids that flagged the job at posting. */
  rules?: string[];
  /** Jobs a ban took down. */
  takenDown?: number;
}

/** Platform-wide counts for the landing page. Real counts only, never estimates. */
export interface PlatformStats {
  /** Employers with at least one job that was not taken down. */
  employersPosting: number;
  /** Jobs ever published and not taken down. */
  jobsPosted: number;
  /** Sum of hires employers confirmed. */
  hiresConfirmed: number;
  /** Times signed-in job seekers revealed contact details (咨询). */
  contactViews: number;
}

/** Which side of the site a signed-in person is using right now. */
export type AccountRole = "seeker" | "employer";

/**
 * One person, one email. Every account can look for work; an account can also open an employer
 * identity for one business and switch between the two.
 */
export interface Account {
  /** Lower-cased, trimmed. */
  email: string;
  createdAt: string; // ISO datetime
  /** Set once the employer identity is opened. */
  employerId?: string;
}
