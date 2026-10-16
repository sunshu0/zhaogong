// A person's own data (#54, R-30): everything the server keeps about an account, for 导出我的数据, and deleting the
// account. What is deleted, what is kept without the person in it, and why: docs/adr/0009-account-deletion.md.
// Server only.
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { listRenewals, type JobRenewal } from "@/db/job-renewals";
import { database } from "@/db/ready";
import { toEmployer, toJob } from "@/db/rows";
import * as t from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";

/** Who applied for 企业验证, once their account is deleted. */
const DELETED_CONTACT = "（已删除的账号）";
import type { AccountRole, Employer, Job } from "@/lib/types";

/** The server's part of the export. The browser adds what it keeps itself (profiles, reports sent, jobs viewed). */
export interface ServerAccountData {
  account: { email: string; createdAt: string; lastRole: AccountRole };
  moderator: { grantedAt: string; grantedBy: string | null } | null;
  /** The moderation decisions this account made as a moderator (#60). */
  moderationActions: { id: string; at: string; action: string; jobId: string | null; employerId: string | null }[];
  /** The business of the employer identity, every job it posted whatever their status, and their renewals (#69). */
  employer: { business: Employer; jobs: Job[]; renewals: JobRenewal[] } | null;
  /** Each identity's chat records and the notifications it has read. */
  chats: { identity: string; record: unknown; notificationsRead: string[]; updatedAt: string }[];
  /** Saved jobs and how far the application got (#52). */
  savedJobs: { jobId: string; savedAt: string; stage: string | null; stageSetAt: string | null }[];
  /** Jobs this account applied for (#84), with the note and the page sent, and what the employer did. */
  applications: {
    jobId: string;
    appliedAt: string;
    note: string;
    profile: unknown;
    seenAt: string | null;
    decision: string | null;
  }[];
  /** The 中英文简历 share link (#86): its id and the page it shows. */
  resumeShare: { id: string; resume: unknown; createdAt: string; updatedAt: string } | null;
  /**
   * The 企业验证 applications this account made (#78), with a moderator's reason when one was rejected. Which
   * moderator decided is left out: that is someone else's email.
   */
  verificationRequests: {
    kind: string;
    nzbn: string;
    legalName: string;
    contactName: string;
    contactRole: string;
    companyPhone: string;
    website: string | null;
    submittedAt: string;
    status: string;
    decidedAt: string | null;
    rejectReason: string | null;
    rejectNote: string | null;
  }[];
  /** Jobs this account started a chat about (counted for the employer, #55). */
  chatStarts: { jobId: string; startedAt: string }[];
  /** Job alerts (#53): saved searches, and the new jobs they found. */
  jobAlerts: { name: string; query: string; paused: boolean; createdAt: string }[];
  jobAlertHits: { jobId: string; alertName: string; createdAt: string }[];
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
  const actions = await db
    .select()
    .from(t.moderationLog)
    .where(eq(t.moderationLog.moderator, address))
    .orderBy(asc(t.moderationLog.at));
  const [business] = account.employerId
    ? await db.select().from(t.employers).where(eq(t.employers.id, account.employerId))
    : [];
  const jobs = business
    ? await db.select().from(t.jobs).where(eq(t.jobs.employerId, business.id)).orderBy(asc(t.jobs.postedAt))
    : [];
  const renewals = await listRenewals(jobs.map((j) => j.id));
  const chats = await db
    .select()
    .from(t.chatRecords)
    .where(eq(t.chatRecords.email, address))
    .orderBy(asc(t.chatRecords.scope));
  const saved = await db
    .select()
    .from(t.savedJobs)
    .where(eq(t.savedJobs.email, address))
    .orderBy(asc(t.savedJobs.savedAt));
  const applications = await db
    .select()
    .from(t.jobApplications)
    .where(eq(t.jobApplications.seekerEmail, address))
    .orderBy(asc(t.jobApplications.appliedAt));
  const [share] = await db.select().from(t.resumeShares).where(eq(t.resumeShares.email, address));
  const starts = await db
    .select()
    .from(t.jobChatStarts)
    .where(eq(t.jobChatStarts.seekerEmail, address))
    .orderBy(asc(t.jobChatStarts.startedAt));
  const verifications = await db
    .select()
    .from(t.verificationRequests)
    .where(eq(t.verificationRequests.submittedByEmail, address))
    .orderBy(asc(t.verificationRequests.submittedAt));
  const alerts = await db
    .select()
    .from(t.jobAlerts)
    .where(eq(t.jobAlerts.email, address))
    .orderBy(asc(t.jobAlerts.createdAt));
  const hits = await db
    .select()
    .from(t.jobAlertHits)
    .where(eq(t.jobAlertHits.email, address))
    .orderBy(asc(t.jobAlertHits.createdAt));
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
    moderationActions: actions.map((a) => ({
      id: a.id,
      at: a.at,
      action: a.action,
      jobId: a.jobId,
      employerId: a.employerId,
    })),
    employer: business ? { business: toEmployer(business), jobs: jobs.map(toJob), renewals } : null,
    chats: chats.map((row) => ({
      identity: row.scope,
      record: row.record ?? null,
      notificationsRead: row.notificationReads ?? [],
      updatedAt: row.updatedAt,
    })),
    savedJobs: saved.map((s) => ({ jobId: s.jobId, savedAt: s.savedAt, stage: s.stage, stageSetAt: s.stageSetAt })),
    applications: applications.map((a) => ({
      jobId: a.jobId,
      appliedAt: a.appliedAt,
      note: a.note,
      profile: a.profile,
      seenAt: a.seenAt,
      decision: a.decision,
    })),
    resumeShare: share
      ? { id: share.id, resume: share.resume, createdAt: share.createdAt, updatedAt: share.updatedAt }
      : null,
    verificationRequests: verifications.map((v) => ({
      kind: v.kind,
      nzbn: v.nzbn,
      legalName: v.legalName,
      contactName: v.contactName,
      contactRole: v.contactRole,
      companyPhone: v.companyPhone,
      website: v.website,
      submittedAt: v.submittedAt,
      status: v.status,
      decidedAt: v.decidedAt,
      rejectReason: v.rejectReason,
      rejectNote: v.rejectNote,
    })),
    chatStarts: starts.map((s) => ({ jobId: s.jobId, startedAt: s.startedAt })),
    jobAlerts: alerts.map((a) => ({ name: a.name, query: a.query, paused: a.paused, createdAt: a.createdAt })),
    jobAlertHits: hits.map((h) => ({ jobId: h.jobId, alertName: h.alertName, createdAt: h.createdAt })),
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
    // The decisions stay in the log (#60), without the moderator's email.
    await tx.update(t.moderationLog).set({ moderator: DELETED_ACCOUNT }).where(eq(t.moderationLog.moderator, address));
    // 企业验证 (#78): a decision is why a business carries its badge, so the application stays, without the person's
    // email or name; one still waiting is withdrawn. Applications this account decided as a moderator lose its email.
    await tx
      .update(t.verificationRequests)
      .set({ status: "withdrawn" })
      .where(and(eq(t.verificationRequests.submittedByEmail, address), eq(t.verificationRequests.status, "pending")));
    await tx
      .update(t.verificationRequests)
      .set({ submittedByEmail: DELETED_ACCOUNT, contactName: DELETED_CONTACT })
      .where(eq(t.verificationRequests.submittedByEmail, address));
    await tx
      .update(t.verificationRequests)
      .set({ decidedByEmail: DELETED_ACCOUNT })
      .where(eq(t.verificationRequests.decidedByEmail, address));

    await tx.delete(t.sessions).where(eq(t.sessions.email, address));
    await tx.delete(t.signInCodes).where(eq(t.signInCodes.email, address));
    await tx.delete(t.chatRecords).where(eq(t.chatRecords.email, address));
    await tx.delete(t.savedJobs).where(eq(t.savedJobs.email, address));
    // Applications are the person's page and note: they go, and the employers' lists lose them (#84).
    await tx.delete(t.jobApplications).where(eq(t.jobApplications.seekerEmail, address));
    // The share link closes with the account (#86).
    await tx.delete(t.resumeShares).where(eq(t.resumeShares.email, address));
    await tx.delete(t.jobAlerts).where(eq(t.jobAlerts.email, address));
    await tx.delete(t.jobAlertHits).where(eq(t.jobAlertHits.email, address));
    await tx
      .update(t.contactViews)
      .set({ viewerEmail: DELETED_ACCOUNT })
      .where(eq(t.contactViews.viewerEmail, address));
    await tx
      .update(t.jobChatStarts)
      .set({ seekerEmail: DELETED_ACCOUNT })
      .where(eq(t.jobChatStarts.seekerEmail, address));

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
