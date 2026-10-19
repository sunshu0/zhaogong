// What a moderator can be shown of someone's personal information in /admin (#336, ADR 0026). Shared by the table
// (src/db/schema.ts), the record (src/db/personal-info-views.ts) and 查看记录, the page that lists them.

/**
 * - verification: a 企业验证 application (the contact's name, role and phone, the business's papers);
 * - contact: a job's contact details (phone, WeChat, email);
 * - profile: a job seeker's profile or résumé;
 * - chat: a conversation's messages.
 * Today /admin shows only verification; the others are named so that a view showing them records under its kind.
 */
export const PERSONAL_INFO_KINDS = ["verification", "contact", "profile", "chat"] as const;
export type PersonalInfoKind = (typeof PERSONAL_INFO_KINDS)[number];

/** The page's periods: the last 7, 30 or 365 New Zealand days; a year is as long as records are kept (KEEP_DAYS). */
export const VIEW_DAYS = [7, 30, 365] as const;
export type ViewDays = (typeof VIEW_DAYS)[number];

/** The most records one query returns, newest first. */
export const LIST_LIMIT = 200;
