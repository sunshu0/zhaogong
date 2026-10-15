// Who may use /admin (#50): a row in moderators per account. Granted from the command line (npm run
// admin:grant) or by another moderator in /admin; the last one cannot be removed. Server only.
import { asc, count, eq } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts, moderators } from "@/db/schema";
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
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.email, address));
    if (!account) return "no_account";
    const [row] = await tx.select().from(moderators).where(eq(moderators.email, address));
    if (row) return "already";
    await tx.insert(moderators).values({ email: address, grantedAt: now.toISOString(), grantedBy });
    return "granted";
  });
}

/** Takes the role away, unless the account is the only moderator left (then nobody could moderate). */
export async function revokeModerator(email: string): Promise<"revoked" | "not_moderator" | "last"> {
  const address = normalizeEmail(email);
  const db = await database();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(moderators).where(eq(moderators.email, address));
    if (!row) return "not_moderator";
    const [{ n }] = await tx.select({ n: count() }).from(moderators);
    if (n <= 1) return "last";
    await tx.delete(moderators).where(eq(moderators.email, address));
    return "revoked";
  });
}
