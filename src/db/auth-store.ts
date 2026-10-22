// Sign-in codes and sessions in the database: the database version of A12-1's AuthStore
// (src/lib/auth/store.ts on a/A12-1-auth), same methods and row shapes, so codes.ts and sessions.ts do not
// change when A switches authStore() over to it. Server only.
import { and, eq, gt, lt, lte, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import { authLimits, sessions, signInCodes } from "@/db/schema";
import type { AccountRole } from "@/lib/types";

export type SignInCodeRow = typeof signInCodes.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;

export function databaseAuthStore() {
  return {
    async getCode(email: string): Promise<SignInCodeRow | undefined> {
      const db = await database();
      const [row] = await db.select().from(signInCodes).where(eq(signInCodes.email, email));
      return row;
    },
    /** Inserts or replaces the email's code. */
    async putCode(row: SignInCodeRow): Promise<void> {
      const db = await database();
      await db.insert(signInCodes).values(row).onConflictDoUpdate({ target: signInCodes.email, set: row });
    },
    async setCodeAttempts(email: string, attempts: number): Promise<void> {
      const db = await database();
      await db.update(signInCodes).set({ attempts }).where(eq(signInCodes.email, email));
    },
    /** One statement: the database counts the try, so parallel guesses each use up one (ADR 0031). */
    async takeCodeAttempt(email: string, max: number, now: string): Promise<SignInCodeRow | undefined> {
      const db = await database();
      const [row] = await db
        .update(signInCodes)
        .set({ attempts: sql`${signInCodes.attempts} + 1` })
        .where(and(eq(signInCodes.email, email), lt(signInCodes.attempts, max), gt(signInCodes.expiresAt, now)))
        .returning();
      return row;
    },
    async useCode(email: string, codeHash: string): Promise<boolean> {
      const db = await database();
      const used = await db
        .delete(signInCodes)
        .where(and(eq(signInCodes.email, email), eq(signInCodes.codeHash, codeHash)))
        .returning({ email: signInCodes.email });
      return used.length > 0;
    },
    async deleteCode(email: string): Promise<void> {
      const db = await database();
      await db.delete(signInCodes).where(eq(signInCodes.email, email));
    },
    /**
     * One statement (ADR 0033): the first count inserts the row, later ones add one only while below `max`, so
     * requests sent at once cannot pass the limit between them. No row back means the limit was reached.
     */
    async takeLimit(key: string, max: number, expiresAt: string): Promise<boolean> {
      const db = await database();
      const rows = await db
        .insert(authLimits)
        .values({ key, count: 1, expiresAt })
        .onConflictDoUpdate({
          target: authLimits.key,
          set: { count: sql`${authLimits.count} + 1` },
          setWhere: lt(authLimits.count, max),
        })
        .returning({ count: authLimits.count });
      return rows.length > 0 && rows[0].count <= max;
    },
    async clearEndedLimits(now: string): Promise<void> {
      const db = await database();
      await db.delete(authLimits).where(lte(authLimits.expiresAt, now));
    },
    async getSession(id: string): Promise<SessionRow | undefined> {
      const db = await database();
      const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
      return row;
    },
    /** The account must exist (sessions.email references accounts.email): sign-in creates it first. */
    async insertSession(row: SessionRow): Promise<void> {
      const db = await database();
      await db.insert(sessions).values(row);
    },
    async setSessionRole(id: string, activeRole: AccountRole): Promise<void> {
      const db = await database();
      await db.update(sessions).set({ activeRole }).where(eq(sessions.id, id));
    },
    async deleteSession(id: string): Promise<void> {
      const db = await database();
      await db.delete(sessions).where(eq(sessions.id, id));
    },
  };
}
