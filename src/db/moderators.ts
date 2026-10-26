// Who may use /admin (#50): a row in moderators per account, and the admins named in the server's configuration
// (ADR 0043, admins.ts), who are moderators too. Only an admin adds or removes moderators — in /admin, or the server's
// owner from the command line (npm run admin:grant) — and every change goes into moderator_changes. A moderator
// account is for moderating only, so the role goes only to an account that holds no job seeker's or employer's data.
// Server only.
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { adminEmails, isAdmin } from "@/db/admins";
import { guardedBatch } from "@/db/guarded-batch";
import { database } from "@/db/ready";
import {
  accounts,
  jobAlerts,
  jobApplications,
  moderatorChanges,
  moderators,
  resumeShares,
  savedExternalJobs,
  savedJobs,
  seekerProfiles,
} from "@/db/schema";
import { insertIf } from "@/db/write-if";
import { normalizeEmail, type StaffRole } from "@/components/seeker/session";

export type Moderator = typeof moderators.$inferSelect;
export type ModeratorChange = typeof moderatorChanges.$inferSelect;

export async function isModerator(email: string): Promise<boolean> {
  return (await staffRole(email)) !== null;
}

/** What the account is on the staff side (ADR 0043), or null for neither. */
export async function staffRole(email: string): Promise<StaffRole | null> {
  if (isAdmin(email)) return "admin";
  const db = await database();
  const [row] = await db
    .select()
    .from(moderators)
    .where(eq(moderators.email, normalizeEmail(email)));
  return row ? "moderator" : null;
}

/** Oldest first. */
export async function listModerators(): Promise<Moderator[]> {
  const db = await database();
  return db.select().from(moderators).orderBy(asc(moderators.grantedAt), asc(moderators.email));
}

/** The admins, as the configuration names them. */
export function listAdmins(): string[] {
  return adminEmails();
}

/** Newest first, at most `limit`. */
export async function listModeratorChanges(limit = 200): Promise<ModeratorChange[]> {
  const db = await database();
  return db.select().from(moderatorChanges).orderBy(desc(moderatorChanges.at), desc(moderatorChanges.id)).limit(limit);
}

/**
 * True in SQL when the account holds anything of a job seeker or an employer: a profile or CV, a shared CV,
 * applications, saved jobs, job alerts, or a business (which covers a place in a team).
 */
function hasOwnData(address: string): SQL {
  const has = (table: typeof savedJobs | typeof savedExternalJobs | typeof jobAlerts | typeof seekerProfiles) =>
    sql`exists (select 1 from ${table} where ${table.email} = ${address})`;
  return sql`(${has(seekerProfiles)} or ${has(savedJobs)} or ${has(savedExternalJobs)} or ${has(jobAlerts)}
    or exists (select 1 from ${resumeShares} where ${resumeShares.email} = ${address})
    or exists (select 1 from ${jobApplications} where ${jobApplications.seekerEmail} = ${address})
    or exists (select 1 from ${accounts} where ${accounts.email} = ${address} and ${accounts.employerId} is not null))`;
}

/**
 * Makes an account a moderator, if it is a clean one (see the top of this file). `grantedBy` is the admin doing it,
 * or null from the command line. An admin is a moderator already, through the configuration.
 */
export async function grantModerator(
  email: string,
  grantedBy: string | null,
  now = new Date(),
): Promise<"granted" | "already" | "no_account" | "has_data"> {
  const address = normalizeEmail(email);
  if (isAdmin(address)) return "already";
  const db = await database();
  const at = now.toISOString();
  // One batch, decided by one condition (ADR 0031): the role and its record go in together, or neither does.
  const { applied } = await guardedBatch(
    db,
    sql`exists (select 1 from ${accounts} where ${accounts.email} = ${address})
      and not exists (select 1 from ${moderators} where ${moderators.email} = ${address})
      and not ${hasOwnData(address)}`,
    (allowed) => [
      insertIf(db, moderators, { email: address, grantedAt: at, grantedBy }, allowed),
      insertIf(db, moderatorChanges, { at, action: "grant", email: address, by: grantedBy }, allowed),
    ],
  );
  if (applied) return "granted";
  const [account] = await db.select({ email: accounts.email }).from(accounts).where(eq(accounts.email, address));
  if (!account) return "no_account";
  const [row] = await db.select({ email: moderators.email }).from(moderators).where(eq(moderators.email, address));
  return row ? "already" : "has_data";
}

/**
 * Takes the role away. An admin's comes from the configuration and cannot be taken here. Moderators can go down to
 * none: the admins are always there to moderate and to add one again (ADR 0043). `by` as for grantModerator.
 */
export async function revokeModerator(
  email: string,
  by: string | null = null,
  now = new Date(),
): Promise<"revoked" | "not_moderator" | "admin"> {
  const address = normalizeEmail(email);
  if (isAdmin(address)) return "admin";
  const db = await database();
  const at = now.toISOString();
  const { applied } = await guardedBatch(
    db,
    sql`exists (select 1 from ${moderators} where ${moderators.email} = ${address})`,
    (allowed) => [
      db.delete(moderators).where(and(eq(moderators.email, address), allowed)),
      insertIf(db, moderatorChanges, { at, action: "revoke", email: address, by }, allowed),
    ],
  );
  return applied ? "revoked" : "not_moderator";
}
