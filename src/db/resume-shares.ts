// 中英文简历的分享链接 (#86, R-37): one per account. Only the account's own Server Functions write it; the share
// page reads it by the link's id. Server only.
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts, resumeShares } from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import type { ResumeDoc } from "@/components/seeker/resume-doc";

export type ResumeShareRow = typeof resumeShares.$inferSelect;

/** Link ids: 18 random bytes, so a link cannot be guessed from another. */
const SHARE_ID = /^[A-Za-z0-9_-]{24}$/;

export async function myResumeShare(email: string): Promise<ResumeShareRow | undefined> {
  const db = await database();
  const [row] = await db
    .select()
    .from(resumeShares)
    .where(eq(resumeShares.email, normalizeEmail(email)));
  return row;
}

/** Shares the page, or updates what an open link shows (the link stays the same). */
export async function saveResumeShare(
  email: string,
  resume: ResumeDoc,
  now = new Date(),
): Promise<ResumeShareRow | "no_account"> {
  const address = normalizeEmail(email);
  const at = now.toISOString();
  const db = await database();
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.email, address));
    if (!account) return "no_account";
    const [existing] = await tx.select().from(resumeShares).where(eq(resumeShares.email, address));
    if (existing) {
      const [row] = await tx
        .update(resumeShares)
        .set({ resume, updatedAt: at })
        .where(eq(resumeShares.email, address))
        .returning();
      return row;
    }
    const [row] = await tx
      .insert(resumeShares)
      .values({ email: address, id: randomBytes(18).toString("base64url"), resume, createdAt: at, updatedAt: at })
      .returning();
    return row;
  });
}

/** Closes the link: it shows nothing from now on. Sharing again makes a new link. */
export async function closeResumeShare(email: string): Promise<boolean> {
  const db = await database();
  const removed = await db
    .delete(resumeShares)
    .where(eq(resumeShares.email, normalizeEmail(email)))
    .returning({ id: resumeShares.id });
  return removed.length > 0;
}

/** The shared page behind a link, or undefined (closed, or never existed). */
export async function sharedResume(id: string): Promise<{ resume: ResumeDoc; updatedAt: string } | undefined> {
  if (typeof id !== "string" || !SHARE_ID.test(id)) return undefined;
  const db = await database();
  const [row] = await db
    .select({ resume: resumeShares.resume, updatedAt: resumeShares.updatedAt })
    .from(resumeShares)
    .where(eq(resumeShares.id, id));
  return row;
}
