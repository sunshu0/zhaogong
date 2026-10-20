// Who may use /admin (#50): a row in moderators per account. Granted from the command line (npm run
// admin:grant) or by another moderator in /admin; the last one cannot be removed. Server only.
import { and, asc, eq, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts, moderators } from "@/db/schema";
import { insertIf } from "@/db/write-if";
import { normalizeEmail } from "@/components/seeker/session";

export type Moderator = typeof moderators.$inferSelect;

export async function isModerator(email: string): Promise<boolean> {
  const db = await database();
  const [row] = await db
    .select()
    .from(moderators)
    .where(eq(moderators.email, normalizeEmail(email)));
  return !!row;
}

/** Oldest first. */
export async function listModerators(): Promise<Moderator[]> {
  const db = await database();
  return db.select().from(moderators).orderBy(asc(moderators.grantedAt), asc(moderators.email));
}

/** Makes an account a moderator. `grantedBy` is the moderator doing it, or null from the command line. */
export async function grantModerator(
  email: string,
  grantedBy: string | null,
  now = new Date(),
): Promise<"granted" | "already" | "no_account"> {
  const address = normalizeEmail(email);
  const db = await database();
  // One statement: the account must exist and must not be a moderator yet when the row goes in (ADR 0031).
  const granted = await insertIf(
    db,
    moderators,
    { email: address, grantedAt: now.toISOString(), grantedBy },
    sql`exists (select 1 from ${accounts} where ${accounts.email} = ${address}) and not exists (select 1 from ${moderators} where ${moderators.email} = ${address})`,
  ).returning({ email: moderators.email });
  if (granted.length) return "granted";
  const [account] = await db.select({ email: accounts.email }).from(accounts).where(eq(accounts.email, address));
  return account ? "already" : "no_account";
}

/** Takes the role away, unless the account is the only moderator left (then nobody could moderate). */
export async function revokeModerator(email: string): Promise<"revoked" | "not_moderator" | "last"> {
  const address = normalizeEmail(email);
  const db = await database();
  // One statement, so two moderators removing each other at once cannot leave nobody (ADR 0031).
  const revoked = await db
    .delete(moderators)
    .where(and(eq(moderators.email, address), sql`(select count(*) from ${moderators}) > 1`))
    .returning({ email: moderators.email });
  if (revoked.length) return "revoked";
  const [row] = await db.select({ email: moderators.email }).from(moderators).where(eq(moderators.email, address));
  return row ? "last" : "not_moderator";
}
