// Database tables. Shapes follow src/lib/types.ts; lists and small objects are stored as JSON, pay in cents.
// The tables under "reserved" are defined now so the migrations carry them, but no code reads them yet:
// sign-in and sessions come with A12-1, chats and exchanges with A12-2.
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  AccountRole,
  EmployerVerification,
  EmploymentType,
  Industry,
  LanguageRequirement,
  ModerationAction,
  ReportReason,
  VisaAccepted,
} from "@/lib/types";
import type { ExchangeKind, ExchangePayload } from "@/lib/chat-consent";

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
});

/** One person, one email; every account can look for work, and can open one employer identity. */
export const accounts = sqliteTable("accounts", {
  email: text("email").primaryKey(), // lower-cased, trimmed
  createdAt: text("created_at").notNull(),
  /** The business of the employer identity, once opened. One business belongs to one account. */
  employerId: text("employer_id")
    .unique()
    .references(() => employers.id),
  /** The identity last used, so a new session starts where the person left off. */
  lastRole: text("last_role").$type<AccountRole>().notNull().default("seeker"),
});

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
export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  seekerEmail: text("seeker_email")
    .notNull()
    .references(() => accounts.email),
  employerId: text("employer_id")
    .notNull()
    .references(() => employers.id),
  jobId: text("job_id").references(() => jobs.id),
  /** Who opened it: a seeker from a job, or an employer from a recommended candidate. */
  startedBy: text("started_by").$type<AccountRole>().notNull(),
  createdAt: text("created_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id),
  from: text("from_role").$type<AccountRole>().notNull(),
  text: text("text").notNull(),
  sentAt: text("sent_at").notNull(),
  readAt: text("read_at"),
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
 * so this holds JSON: the ChatRecord, the notifications read, and the newest change tickets applied. The
 * conversations, messages and exchanges tables above stay for a later chat both sides share.
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
