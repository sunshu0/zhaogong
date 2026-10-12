// Database tables. Owned by the lead; shapes follow src/lib/types.ts, lists and small objects stored as JSON.
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  EmployerVerification,
  EmploymentType,
  Industry,
  LanguageRequirement,
  ModerationAction,
  ReportReason,
  VisaAccepted,
} from "@/lib/types";

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
  employmentType: text("employment_type").$type<EmploymentType>().notNull(),
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

export const accounts = sqliteTable("accounts", {
  email: text("email").primaryKey(), // lower-cased, trimmed
  createdAt: text("created_at").notNull(),
  employerId: text("employer_id")
    .unique()
    .references(() => employers.id),
});

/** One-time sign-in codes. Stored hashed; one live code per email. */
export const signInCodes = sqliteTable("sign_in_codes", {
  email: text("email").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: text("expires_at").notNull(),
  attempts: integer("attempts").notNull(),
  createdAt: text("created_at").notNull(),
});

/** Server sessions behind an httpOnly cookie. The cookie holds the random id only. */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").notNull(),
    email: text("email")
      .notNull()
      .references(() => accounts.email),
    activeRole: text("active_role").$type<"seeker" | "employer">().notNull(),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.id] })],
);
