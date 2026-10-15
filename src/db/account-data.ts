// A person's own data (#54, R-30): everything the server keeps about an account, for 导出我的数据, and deleting the
// account. What is deleted, what is kept without the person in it, and why: docs/adr/0009-account-deletion.md.
// Server only.
import { asc, count, eq, inArray } from "drizzle-orm";
import { database } from "@/db/ready";
import { toEmployer, toJob } from "@/db/rows";
import * as t from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import type { AccountRole, Employer, Job } from "@/lib/types";

/** The server's part of the export. The browser adds what it keeps itself (profiles, reports sent, jobs viewed). */
export interface ServerAccountData {
  account: { email: string; createdAt: string; lastRole: AccountRole };
  moderator: { grantedAt: string; grantedBy: string | null } | null;
  /** The business of the employer identity and every job it posted, whatever their status. */
  employer: { business: Employer; jobs: Job[] } | null;
  /** Each identity's chat records and the notifications it has read. */
  chats: { identity: string; record: unknown; notificationsRead: string[]; updatedAt: string }[];
  /** Jobs whose public contact details this account looked at. */
  contactViews: { jobId: string; viewedAt: string }[];
  /** Signed-in sessions. The cookie token is never stored, so there is nothing more to show. */
  sessions: { activeRole: AccountRole; createdAt: string; expiresAt: string }[];
}

export async function exportAccountData(email: string): Promise<ServerAccountData | undefined> {
  const address = normalizeEmail(email);
  const db = await database();
  const [account] = await db.select().from(t.accounts).where(eq(t.accounts.email, address));
  if (!account) return undefined;
  const [moderator] = await db.select().from(t.moderators).where(eq(t.moderators.email, address));
  const [business] = account.employerId
    ? await db.select().from(t.employers).where(eq(t.employers.id, account.employerId))
    : [];
  const jobs = business
    ? await db.select().from(t.jobs).where(eq(t.jobs.employerId, business.id)).orderBy(asc(t.jobs.postedAt))
    : [];
  const chats = await db
    .select()
    .from(t.chatRecords)
    .where(eq(t.chatRecords.email, address))
    .orderBy(asc(t.chatRecords.scope));
  const views = await db
    .select()
    .from(t.contactViews)
    .where(eq(t.contactViews.viewerEmail, address))
    .orderBy(asc(t.contactViews.viewedAt));
  const sessions = await db
    .select()
    .from(t.sessions)
    .where(eq(t.sessions.email, address))
    .orderBy(asc(t.sessions.createdAt));

  return {
    account: { email: account.email, createdAt: account.createdAt, lastRole: account.lastRole },
    moderator: moderator ? { grantedAt: moderator.grantedAt, grantedBy: moderator.grantedBy } : null,
    employer: business ? { business: toEmployer(business), jobs: jobs.map(toJob) } : null,
    chats: chats.map((row) => ({
      identity: row.scope,
      record: row.record ?? null,
      notificationsRead: row.notificationReads ?? [],
      updatedAt: row.updatedAt,
    })),
    contactViews: views.map((v) => ({ jobId: v.jobId, viewedAt: v.viewedAt })),
    sessions: sessions.map((s) => ({ activeRole: s.activeRole, createdAt: s.createdAt, expiresAt: s.expiresAt })),
  };
}

export type DeleteAccountResult = "deleted" | "no_account" | "last_moderator";

/**
 * Deletes the account and everything that is only about it, in one transaction. The business's jobs come down and
 * lose their contact details; records other people rely on stay, with the email replaced. The last moderator cannot
 * go (nobody could moderate). The caller ends the browser's session.
 */
export async function deleteAccount(email: string): Promise<DeleteAccountResult> {
  const address = normalizeEmail(email);
  const db = await database();
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(t.accounts).where(eq(t.accounts.email, address));
    if (!account) return "no_account";
    const [moderator] = await tx.select().from(t.moderators).where(eq(t.moderators.email, address));
    if (moderator) {
      const [{ n }] = await tx.select({ n: count() }).from(t.moderators);
      if (n <= 1) return "last_moderator";
      await tx.delete(t.moderators).where(eq(t.moderators.email, address));
    }
    await tx.update(t.moderators).set({ grantedBy: DELETED_ACCOUNT }).where(eq(t.moderators.grantedBy, address));

    await tx.delete(t.sessions).where(eq(t.sessions.email, address));
    await tx.delete(t.signInCodes).where(eq(t.signInCodes.email, address));
    await tx.delete(t.chatRecords).where(eq(t.chatRecords.email, address));
    await tx
      .update(t.contactViews)
      .set({ viewerEmail: DELETED_ACCOUNT })
      .where(eq(t.contactViews.viewerEmail, address));

    // The shared chat tables are not written yet (A12-2 keeps chats per identity in chat_records), but they hold
    // the seeker's email, so a conversation goes with its messages and exchanges.
    const conversations = await tx
      .select({ id: t.conversations.id })
      .from(t.conversations)
      .where(eq(t.conversations.seekerEmail, address));
    if (conversations.length) {
      const ids = conversations.map((c) => c.id);
      await tx.delete(t.messages).where(inArray(t.messages.conversationId, ids));
      await tx.delete(t.exchanges).where(inArray(t.exchanges.conversationId, ids));
      await tx.delete(t.conversations).where(inArray(t.conversations.id, ids));
    }

    // The business stays (reports and the moderation log name it, and a ban must outlive the account), but nobody
    // posts for it any more: its jobs come down and the contact details on them, the person's own, are cleared.
    if (account.employerId) {
      await tx
        .update(t.jobs)
        .set({ status: "removed", contact: {}, contactPublic: false })
        .where(eq(t.jobs.employerId, account.employerId));
    }

    await tx.delete(t.accounts).where(eq(t.accounts.email, address));
    return "deleted";
  });
}
