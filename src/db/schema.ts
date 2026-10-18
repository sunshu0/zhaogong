// Database tables. Shapes follow src/lib/types.ts; lists and small objects are stored as JSON, pay in cents.
// The tables under "reserved" are defined now so the migrations carry them, but no code reads them yet:
// sign-in and sessions come with A12-1, chats and exchanges with A12-2.
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { JobRoleId } from "@/config/job-roles";
import type {
  AccountRole,
  CountryCode,
  EmployerVerification,
  EmploymentType,
  Industry,
  LanguageRequirement,
  ModerationAction,
  ReportReason,
  VisaAccepted,
} from "@/lib/types";
import type { ExchangeKind, ExchangePayload } from "@/lib/chat-consent";
import type { SavedStage } from "@/components/seeker/saved-jobs";
import type { ApplicationDecision, ApplicationProfile } from "@/components/seeker/applications";
import type { ResumeDoc } from "@/components/seeker/resume-doc";
import type { InterviewMode, InterviewStatus } from "@/components/seeker/interviews";
import type { Profile } from "@/components/seeker/hub-state";
import type { Checklist, RejectReason, RequestStatus, VerifyKind } from "@/components/employer/verification";
import type { TeamInviteStatus, TeamRole } from "@/components/employer/team";
import type { EmployerPage } from "@/components/employer/employer-page";
import type {
  DegreeLevel,
  DegreeSubject,
  ExternalCity,
  ExternalField,
  ExternalFlag,
  ExternalKind,
  ExternalPay,
  ExternalSource,
  VisaFact,
} from "@/lib/external-jobs/types";
import type { ExternalBlockKind, ExternalRemovedReason, ExternalReview } from "@/lib/external-jobs/visibility";
import type { ExternalSection } from "@/lib/external-jobs/filter";
import type { AiUsageResult } from "@/lib/ai-post/model/limits";

export const employers = sqliteTable("employers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  businessNumber: text("business_number"),
  verification: text("verification").$type<EmployerVerification>().notNull(),
  regionId: text("region_id").notNull(),
  createdAt: text("created_at").notNull(),
  bannedAt: text("banned_at"),
});

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  country: text("country").$type<"NZ" | "AU">().notNull(),
  employerId: text("employer_id")
    .notNull()
    .references(() => employers.id),
  titleZh: text("title_zh").notNull(),
  titleEn: text("title_en").notNull(),
  industry: text("industry").$type<Industry>().notNull(),
  /** 岗位类别 (#96, migration 0014); [] is 待选. Nullable, as 0005 adds no SQL DEFAULT; 0014 fills every row. */
  roles: text("roles", { mode: "json" }).$type<JobRoleId[]>(),
  /** Every form of employment the job accepts (B20). */
  employmentType: text("employment_type", { mode: "json" }).$type<EmploymentType[]>().notNull(),
  regionId: text("region_id").notNull(),
  address: text("address"),
  payMin: integer("pay_min_cents").notNull(), // cents, so 24.5 → 2450
  payMax: integer("pay_max_cents"),
  hoursMin: integer("hours_min"),
  hoursMax: integer("hours_max"),
  shiftsZh: text("shifts_zh"),
  mealsIncluded: integer("meals_included", { mode: "boolean" }).notNull(),
  accommodationIncluded: integer("accommodation_included", { mode: "boolean" }).notNull(),
  visaAccepted: text("visa_accepted", { mode: "json" }).$type<VisaAccepted[]>().notNull(),
  languages: text("languages", { mode: "json" }).$type<LanguageRequirement[]>().notNull(),
  descriptionZh: text("description_zh").notNull(),
  descriptionEn: text("description_en").notNull(),
  /** The employer's choice (B23): show `contact` to signed-in seekers, or swap details in chat. */
  contactPublic: integer("contact_public", { mode: "boolean" }).notNull().default(false),
  contact: text("contact", { mode: "json" }).$type<{ phone?: string; wechat?: string; email?: string }>().notNull(),
  status: text("status").$type<"active" | "expired" | "removed" | "pending_review">().notNull(),
  postedAt: text("posted_at").notNull(),
  expiresAt: text("expires_at").notNull(),
  urgent: integer("urgent", { mode: "boolean" }).notNull(),
  hiresConfirmed: integer("hires_confirmed"),
  hiresConfirmedAt: text("hires_confirmed_at"),
  /**
   * The account that posted it (#182, migration 0023): set from the session when publishing, null on jobs from
   * before and on demo jobs, deleted-account once that account is gone. Not part of `Job`: only the business's own
   * team sees it (`listJobPosters`), never the job's public page.
   */
  postedBy: text("posted_by_email"),
  /**
   * Who last changed the job's contact details (#186, migration 0024); null while they are the poster's. 职位管理
   * warns the team when that person is no longer in it. Never part of `Job`, like `postedBy`.
   */
  contactBy: text("contact_by_email"),
});

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  reason: text("reason").$type<ReportReason>().notNull(),
  note: text("note"),
  createdAt: text("created_at").notNull(),
  status: text("status").$type<"open" | "actioned" | "dismissed">().notNull(),
  /** When a moderator closed it (#70); null while open, and for reports closed before migration 0008. */
  handledAt: text("handled_at"),
});

export const contactViews = sqliteTable("contact_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: text("job_id")
    .notNull()
    .references(() => jobs.id),
  viewerEmail: text("viewer_email").notNull(),
  viewedAt: text("viewed_at").notNull(),
});

export const moderationLog = sqliteTable("moderation_log", {
  id: text("id").primaryKey(),
  at: text("at").notNull(),
  action: text("action").$type<ModerationAction>().notNull(),
  jobId: text("job_id"),
  jobTitle: text("job_title"),
  employerId: text("employer_id"),
  employerName: text("employer_name"),
  reasons: text("reasons", { mode: "json" }).$type<ReportReason[]>(),
  rules: text("rules", { mode: "json" }).$type<string[]>(),
  takenDown: integer("taken_down"),
  /** The moderator who acted (#60); null on entries from before #60, deleted-account once that account is gone. */
  moderator: text("moderator_email"),
  /** 企业验证 decisions (#78): what was applied for, and a rejection's reason and note. */
  note: text("note"),
});

/** One person, one email; every account can look for work, and can open one employer identity. */
export const accounts = sqliteTable(
  "accounts",
  {
    email: text("email").primaryKey(), // lower-cased, trimmed
    createdAt: text("created_at").notNull(),
    /**
     * The business of the employer identity, once opened. An account works for one business; a business can have
     * a team of accounts (#87, ADR 0012).
     */
    employerId: text("employer_id").references(() => employers.id),
    /** The identity last used, so a new session starts where the person left off. */
    lastRole: text("last_role").$type<AccountRole>().notNull().default("seeker"),
    /** Set together with employerId (#87): admin or member of the business's team, and since when. */
    teamRole: text("team_role").$type<TeamRole>(),
    /** What the team calls this person in the business's chats, e.g. 王经理 (#87). */
    teamName: text("team_name"),
    teamJoinedAt: text("team_joined_at"),
  },
  (table) => [index("accounts_employer_idx").on(table.employerId)],
);

/**
 * An admin's invitation for an account to join the business's team (#87). The invited account must exist and have
 * no business; it accepts or declines. Rows stay as the record; the inviter's email becomes deleted-account when
 * that account is deleted, and an invited account's rows go with it.
 */
export const teamInvites = sqliteTable(
  "team_invites",
  {
    id: text("id").primaryKey(),
    employerId: text("employer_id")
      .notNull()
      .references(() => employers.id),
    email: text("email")
      .notNull()
      .references(() => accounts.email),
    role: text("role").$type<TeamRole>().notNull(),
    invitedByEmail: text("invited_by_email").notNull(),
    createdAt: text("created_at").notNull(),
    status: text("status").$type<TeamInviteStatus>().notNull(),
    answeredAt: text("answered_at"),
  },
  (table) => [index("team_invites_email_idx").on(table.email), index("team_invites_employer_idx").on(table.employerId)],
);

// ---- reserved: sign-in and sessions (A12-1) ----

/** One-time sign-in codes. Stored hashed; one live code per email. */
export const signInCodes = sqliteTable("sign_in_codes", {
  email: text("email").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  attempts: integer("attempts")
    .notNull()
    .$default(() => 0),
  createdAt: text("created_at").notNull(),
});

/**
 * Server sessions behind an httpOnly cookie. The cookie holds the random token; the id is its SHA-256, so the
 * token itself is never stored. The employer identity is not kept here: it is read from accounts.employer_id.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    email: text("email")
      .notNull()
      .references(() => accounts.email),
    activeRole: text("active_role").$type<AccountRole>().notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [index("sessions_email_idx").on(table.email)],
);

// ---- reserved: chats and exchanges on the server (A12-2) ----

/** A chat between a job seeker and a business, usually about one job. */
/**
 * A chat a job seeker account and a business share (#110, ADR 0015): one per job seeker, business and job. Everyone in
 * the business's team reads and writes it.
 */
export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    seekerEmail: text("seeker_email")
      .notNull()
      .references(() => accounts.email),
    employerId: text("employer_id")
      .notNull()
      .references(() => employers.id),
    jobId: text("job_id").references(() => jobs.id),
    /** Who opened it: a seeker from a job, or an employer from an applicant or a recommended candidate. */
    startedBy: text("started_by").$type<AccountRole>().notNull(),
    /** The job seeker's name as the business first saw it, until the job seeker has a page on their account. */
    seekerName: text("seeker_name"),
    /** How far each side has read. */
    seekerReadAt: text("seeker_read_at"),
    employerReadAt: text("employer_read_at"),
    /** The newest message or exchange, for the order of the list. */
    updatedAt: text("updated_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("conversations_seeker_employer_job_idx").on(table.seekerEmail, table.employerId, table.jobId),
  ],
);

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id),
  from: text("from_role").$type<AccountRole>().notNull(),
  text: text("text").notNull(),
  sentAt: text("sent_at").notNull(),
  /** Unused: each side's read time is on the conversation. */
  readAt: text("read_at"),
  /** Who in the business's team sent it (ADR 0012); null for the job seeker's. */
  byName: text("by_name"),
});

/** A request to swap contact details or profiles: the side that asks offers its own first (A24). */
export const exchanges = sqliteTable("exchanges", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id),
  kind: text("kind").$type<ExchangeKind>().notNull(),
  requestedBy: text("requested_by").$type<AccountRole>().notNull(),
  status: text("status").$type<"pending" | "accepted" | "rejected" | "cancelled">().notNull(),
  offered: text("offered", { mode: "json" }).$type<ExchangePayload>().notNull(),
  response: text("response", { mode: "json" }).$type<ExchangePayload>(),
  createdAt: text("created_at").notNull(),
  respondedAt: text("responded_at"),
});

// ---- each identity's own chat records on the server (A12-2 / #10, stored by #42) ----

/**
 * One row per identity (identityScope: email, role and business). #10 keeps every identity's own copy of its chats,
 * so this holds JSON: the ChatRecord, the notifications read, and the newest change tickets applied. Chats both sides
 * share (#110) are in the conversations, messages and exchanges tables above.
 */
export const chatRecords = sqliteTable(
  "chat_records",
  {
    scope: text("scope").primaryKey(),
    /** The account the identity belongs to, so its records can go with it. */
    email: text("email")
      .notNull()
      .references(() => accounts.email),
    /** A ChatRecord; checked with parseChatRecord when read. */
    record: text("record", { mode: "json" }).$type<unknown>(),
    notificationReads: text("notification_reads", { mode: "json" }).$type<string[]>(),
    appliedChanges: text("applied_changes", { mode: "json" }).$type<string[]>(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("chat_records_email_idx").on(table.email)],
);

/**
 * A business's chat record (#87): the conversations everyone in its team shares, as a ChatRecord (checked with
 * parseChatRecord when read). Notification reads and change tickets stay per person in chat_records.
 */
export const teamChats = sqliteTable("team_chats", {
  employerId: text("employer_id")
    .primaryKey()
    .references(() => employers.id),
  record: text("record", { mode: "json" }).$type<unknown>().notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ---- moderators (#50) ----

/**
 * Accounts that may use /admin. A row per moderator rather than a column on accounts: adding a NOT NULL column to
 * an existing SQLite table needs an SQL DEFAULT (which #31 keeps out for D1), and the row also says who granted it.
 */
export const moderators = sqliteTable("moderators", {
  email: text("email")
    .primaryKey()
    .references(() => accounts.email),
  grantedAt: text("granted_at").notNull(),
  /** The moderator who added this one in /admin; null when granted from the command line (npm run admin:grant). */
  grantedBy: text("granted_by"),
});

/**
 * 收藏和进度 (#52): jobs an account saved, with how far it got. Only the account itself reads it, never the
 * employer. `stage` is null until the account picks one (then the chat decides between 已收藏 and 已联系).
 */
export const savedJobs = sqliteTable(
  "saved_jobs",
  {
    email: text("email")
      .notNull()
      .references(() => accounts.email),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    savedAt: text("saved_at").notNull(),
    stage: text("stage").$type<SavedStage>(),
    stageSetAt: text("stage_set_at"),
  },
  (t) => [primaryKey({ columns: [t.email, t.jobId] })],
);

// ---- job numbers for the employer (#55) ----

/**
 * One row per job, day and browser that opened the job page, so a browser counts once a day. `visitor` is the
 * SHA-256 of a random id in an httpOnly cookie: no IP, no account, nothing that leads back to a person.
 */
export const jobViews = sqliteTable(
  "job_views",
  {
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    /** The day in New Zealand, YYYY-MM-DD. */
    day: text("day").notNull(),
    visitor: text("visitor").notNull(),
  },
  (t) => [primaryKey({ columns: [t.jobId, t.day, t.visitor] })],
);

/**
 * A job seeker's first message about a job: one row per person and job (checked in code, since a deleted account's
 * rows all become deleted-account and still count).
 */
export const jobChatStarts = sqliteTable(
  "job_chat_starts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    seekerEmail: text("seeker_email").notNull(),
    startedAt: text("started_at").notNull(),
  },
  (t) => [index("job_chat_starts_job_idx").on(t.jobId)],
);

// ---- job alerts (#53) ----

/**
 * A job seeker's saved search (PRD R-29): the job list's filter as its query string, at most 5 per account. With a
 * `section` (#131, ADR 0020) it is a search of 实习 or 专业职位 instead, and the query is that section's filter.
 */
export const jobAlerts = sqliteTable(
  "job_alerts",
  {
    id: text("id").primaryKey(),
    email: text("email")
      .notNull()
      .references(() => accounts.email),
    name: text("name").notNull(),
    country: text("country").$type<CountryCode>().notNull(),
    /**
     * filterToQuery of the filter; read with parseFilter, so values the app no longer knows drop out. For a section,
     * externalFilterToQuery of the section's filter.
     */
    query: text("query").notNull(),
    /** Null for the job list (#53); the section for an alert on external jobs (#131). */
    section: text("section").$type<ExternalSection>(),
    paused: integer("paused", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("job_alerts_email_idx").on(table.email)],
);

/** A new job an alert found for an account. One row per account and job, so a job is announced to a person once. */
export const jobAlertHits = sqliteTable(
  "job_alert_hits",
  {
    email: text("email")
      .notNull()
      .references(() => accounts.email),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    /** The alert's name when it matched: the alert may be renamed or deleted later, the notification stays. */
    alertName: text("alert_name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.email, table.jobId] })],
);

// ---- renewals (#69) ----

/**
 * Each time an employer pushed a job's closing date back (PRD R-33): when, by how many days, and the closing date
 * before and after. Only the employer's own pages read it.
 */
export const jobRenewals = sqliteTable(
  "job_renewals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    renewedAt: text("renewed_at").notNull(),
    days: integer("days").notNull(),
    expiresBefore: text("expires_before").notNull(),
    expiresAfter: text("expires_after").notNull(),
  },
  (table) => [index("job_renewals_job_idx").on(table.jobId)],
);

/**
 * 一键申请 (#84, R-35): one row per job seeker and job. The employer reaches it by `id` and never sees the email;
 * `profile` is the job seeker's page as it was when they applied (it lives in their browser). Withdrawing deletes
 * the row.
 */
export const jobApplications = sqliteTable(
  "job_applications",
  {
    id: text("id").primaryKey(),
    seekerEmail: text("seeker_email")
      .notNull()
      .references(() => accounts.email),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    employerId: text("employer_id")
      .notNull()
      .references(() => employers.id),
    note: text("note").notNull(),
    profile: text("profile", { mode: "json" }).$type<ApplicationProfile>().notNull(),
    appliedAt: text("applied_at").notNull(),
    seenAt: text("seen_at"),
    decision: text("decision").$type<ApplicationDecision>(),
    decidedAt: text("decided_at"),
  },
  (table) => [
    uniqueIndex("job_applications_seeker_job_idx").on(table.seekerEmail, table.jobId),
    index("job_applications_job_idx").on(table.jobId),
    index("job_applications_employer_idx").on(table.employerId),
  ],
);

/**
 * 中英文简历的分享链接 (#86, R-37): at most one per account. `id` is the random part of the link; `resume` is the
 * page as it was when last shared (it lives in the person's browser), without the email. Closing the link deletes
 * the row.
 */
export const resumeShares = sqliteTable("resume_shares", {
  email: text("email")
    .primaryKey()
    .references(() => accounts.email),
  id: text("id").notNull().unique(),
  resume: text("resume", { mode: "json" }).$type<ResumeDoc>().notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
// ---- 企业验证 by a person (#78) ----

/**
 * An employer's application for a badge (PRD R-16, ADR 0011): the register entry it chose, who is applying and the
 * company's phone; a moderator approves or rejects it after a checklist. One pending application per NZBN at a time.
 * The emails are replaced by deleted-account when an account is deleted.
 */
export const verificationRequests = sqliteTable(
  "verification_requests",
  {
    id: text("id").primaryKey(),
    employerId: text("employer_id")
      .notNull()
      .references(() => employers.id),
    kind: text("kind").$type<VerifyKind>().notNull(),
    nzbn: text("nzbn").notNull(),
    /** The register's name for the company, and the shop's name, when the application was made. */
    legalName: text("legal_name").notNull(),
    tradingName: text("trading_name").notNull(),
    contactName: text("contact_name").notNull(),
    contactRole: text("contact_role").notNull(),
    companyPhone: text("company_phone").notNull(),
    website: text("website"),
    submittedByEmail: text("submitted_by_email").notNull(),
    submittedAt: text("submitted_at").notNull(),
    status: text("status").$type<RequestStatus>().notNull(),
    decidedAt: text("decided_at"),
    decidedByEmail: text("decided_by_email"),
    checklist: text("checklist", { mode: "json" }).$type<Checklist>(),
    rejectReason: text("reject_reason").$type<RejectReason>(),
    rejectNote: text("reject_note"),
  },
  (table) => [
    index("verification_requests_employer_idx").on(table.employerId),
    index("verification_requests_status_idx").on(table.status),
  ],
);
// ---- external jobs (Round 18, #111, ADR 0014) ----

/**
 * A job read from a company's public job-board API: facts only, never the posting's text (ADR 0014). Shown only
 * after a moderator approves it (#112), while it is still in the company's feed, refreshed in the last 2 days and
 * not past its closing date (src/lib/external-jobs/visibility.ts). Belongs to no account.
 */
export const externalJobs = sqliteTable(
  "external_jobs",
  {
    /** `<company>:<id in the source>`. */
    id: text("id").primaryKey(),
    companyId: text("company_id").notNull(),
    companyName: text("company_name").notNull(),
    source: text("source").$type<ExternalSource>().notNull(),
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    location: text("location").notNull(),
    city: text("city").$type<ExternalCity>().notNull(),
    field: text("field").$type<ExternalField>().notNull(),
    kind: text("kind").$type<ExternalKind>(),
    closesAt: text("closes_at"),
    minYears: integer("min_years"),
    degree: text("degree").$type<DegreeLevel>(),
    degreeSubjects: text("degree_subjects", { mode: "json" }).$type<DegreeSubject[]>().notNull(),
    visa: text("visa", { mode: "json" }).$type<VisaFact[]>().notNull(),
    pay: text("pay", { mode: "json" }).$type<ExternalPay>(),
    url: text("url").notNull(),
    postedAt: text("posted_at"),
    flags: text("flags", { mode: "json" }).$type<ExternalFlag[]>().notNull(),
    firstSeenAt: text("first_seen_at").notNull(),
    /** The last import that found it in the company's feed: 「信息取于」. */
    lastSeenAt: text("last_seen_at").notNull(),
    removedAt: text("removed_at"),
    removedReason: text("removed_reason").$type<ExternalRemovedReason>(),
    review: text("review").$type<ExternalReview>().notNull(),
    reviewedAt: text("reviewed_at"),
  },
  (table) => [
    index("external_jobs_company_idx").on(table.companyId),
    index("external_jobs_review_idx").on(table.review),
  ],
);

/**
 * Companies a moderator stopped (#112): `stopped` by a moderator's decision, or `takedown` when the company asked
 * to be removed. While a row is here the importer does not read the company and none of its jobs show; the
 * moderation log keeps who did it and when.
 */
export const externalCompanyBlocks = sqliteTable("external_company_blocks", {
  companyId: text("company_id").primaryKey(),
  kind: text("kind").$type<ExternalBlockKind>().notNull(),
  /** For a takedown: who asked, as the company wrote (a company address or role, not a private person). */
  requester: text("requester"),
  note: text("note").notNull(),
  createdAt: text("created_at").notNull(),
});

/**
 * 收藏 for external jobs (#131, ADR 0020): saved_jobs for the 实习 and 专业职位 sections. A table of its own because
 * saved_jobs.job_id is a foreign key to jobs. `stage` is null until the account picks one: there is no chat to say
 * 已联系.
 */
export const savedExternalJobs = sqliteTable(
  "saved_external_jobs",
  {
    email: text("email")
      .notNull()
      .references(() => accounts.email),
    externalJobId: text("external_job_id")
      .notNull()
      .references(() => externalJobs.id),
    savedAt: text("saved_at").notNull(),
    stage: text("stage").$type<SavedStage>(),
    stageSetAt: text("stage_set_at"),
  },
  (t) => [primaryKey({ columns: [t.email, t.externalJobId] })],
);

/**
 * An external job a section's alert found for an account (#131), when a moderator approved it. One row per account
 * and job, as job_alert_hits.
 */
export const externalJobAlertHits = sqliteTable(
  "external_job_alert_hits",
  {
    email: text("email")
      .notNull()
      .references(() => accounts.email),
    externalJobId: text("external_job_id")
      .notNull()
      .references(() => externalJobs.id),
    /** The alert's name when it matched. */
    alertName: text("alert_name").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.email, table.externalJobId] })],
);

/**
 * 约面试 (#103): at most one per application, changed in place when the employer changes the times. `slots` are the
 * instants the employer offered (empty with `call_first`, 电话联系后再定); `chosen_slot` the one confirmed; `reply`
 * the job seeker's own words when declining or saying what suits. `invited_at` is the employer's last change (new
 * times or cancelling), `responded_at` the job seeker's last answer; notifications are keyed by them.
 */
export const interviews = sqliteTable("interviews", {
  id: text("id").primaryKey(),
  applicationId: text("application_id")
    .notNull()
    .unique()
    .references(() => jobApplications.id),
  status: text("status").$type<InterviewStatus>().notNull(),
  slots: text("slots", { mode: "json" }).$type<string[]>().notNull(),
  callFirst: integer("call_first", { mode: "boolean" }).notNull(),
  mode: text("mode").$type<InterviewMode>(),
  place: text("place").notNull(),
  note: text("note").notNull(),
  chosenSlot: text("chosen_slot"),
  reply: text("reply").notNull(),
  invitedAt: text("invited_at").notNull(),
  respondedAt: text("responded_at"),
  createdAt: text("created_at").notNull(),
});

// ---- 求职者主页 on the server (#104) ----

/**
 * The job seeker's 我的主页, one per account (#104): what the person changed from the page they started with (`initialProfile`), as the browser
 * keeps it (`parseProfilePatch`), so both read it the same way. The browser holds a copy for when the server cannot
 * be reached. `updated_at` is the last save; a browser compares it with the copy it has to tell whether the account
 * changed elsewhere since.
 */
export const seekerProfiles = sqliteTable("seeker_profiles", {
  email: text("email")
    .primaryKey()
    .references(() => accounts.email),
  profile: text("profile", { mode: "json" }).$type<Partial<Profile>>().notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ---- 企业主页 on the server (ADR 0022) ----

/**
 * A business's 企业主页, one per business (ADR 0022): the public fields only (`parseEmployerPage`), as what was
 * changed from the empty page, like `seeker_profiles`. Everyone in the team and the public page read it; only an admin
 * writes it. `updated_by_email` is who saved last (deleted-account once that account is gone).
 */
export const employerProfiles = sqliteTable("employer_profiles", {
  employerId: text("employer_id")
    .primaryKey()
    .references(() => employers.id),
  page: text("page", { mode: "json" }).$type<EmployerPage>().notNull(),
  updatedAt: text("updated_at").notNull(),
  updatedByEmail: text("updated_by_email").notNull(),
});

// ---- AI 发帖用量 (#102) ----

/**
 * One row for each call to the posting model (#102, ADR 0018), and for each call the limits turned away (`limited`,
 * no tokens). The limits count an account's calls here; 审核数据 adds up the last seven days. Times are ISO strings.
 * When the account is deleted its rows stay without the email, like the moderation log.
 */
export const aiUsage = sqliteTable(
  "ai_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    at: text("at").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    cacheReadTokens: integer("cache_read_tokens").notNull(),
    cacheWriteTokens: integer("cache_write_tokens").notNull(),
    result: text("result").$type<AiUsageResult>().notNull(),
  },
  (table) => [index("ai_usage_email_at_idx").on(table.email, table.at), index("ai_usage_at_idx").on(table.at)],
);
