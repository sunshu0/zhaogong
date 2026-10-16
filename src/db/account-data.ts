// A person's own data (#54, R-30): everything the server keeps about an account, for 导出我的数据, and deleting the
// account. What is deleted, what is kept without the person in it, and why: docs/adr/0009-account-deletion.md.
// Server only.
import { and, asc, count, eq, inArray, ne, or } from "drizzle-orm";
import { listAiUsageOf, type AiUsageRow } from "@/db/ai-usage";
import { listSharedConversations } from "@/db/conversations";
import { listRenewals, type JobRenewal } from "@/db/job-renewals";
import { database } from "@/db/ready";
import { toEmployer, toJob } from "@/db/rows";
import * as t from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import type { SharedConversation } from "@/lib/chat-server/shared-view";

/** Who applied for 企业验证, once their account is deleted. */
const DELETED_CONTACT = "（已删除的账号）";
import type { AccountRole, Employer, Job } from "@/lib/types";

/** The server's part of the export. The browser adds what it keeps itself (profiles, reports sent, jobs viewed). */
export interface ServerAccountData {
  account: { email: string; createdAt: string; lastRole: AccountRole };
  /** The account's place in its business's team (#87): role, the name the team sees, since when. */
  team: { role: string; name: string | null; joinedAt: string | null } | null;
  /** Team invitations this account received or sent (#87), whatever their status. */
  teamInvites: { employerId: string; role: string; received: boolean; status: string; createdAt: string }[];
  moderator: { grantedAt: string; grantedBy: string | null } | null;
  /** The moderation decisions this account made as a moderator (#60). */
  moderationActions: { id: string; at: string; action: string; jobId: string | null; employerId: string | null }[];
  /** The business of the employer identity, every job it posted whatever their status, and their renewals (#69). */
  employer: { business: Employer; jobs: Job[]; renewals: JobRenewal[] } | null;
  /** Each identity's chat records and the notifications it has read. */
  chats: { identity: string; record: unknown; notificationsRead: string[]; updatedAt: string }[];
  /**
   * The job seeker's chats with businesses (#110), both sides' messages and exchanges. What the person wrote for a
   * business is the business's chat, like its other chats (ADR 0012), so it is not here.
   */
  sharedChats: SharedConversation[];
  /** Saved jobs and how far the application got (#52). */
  savedJobs: { jobId: string; savedAt: string; stage: string | null; stageSetAt: string | null }[];
  /** Saved external jobs of 实习 and 专业职位 (#131). */
  savedExternalJobs: { externalJobId: string; savedAt: string; stage: string | null; stageSetAt: string | null }[];
  /** Jobs this account applied for (#84), with the note and the page sent, and what the employer did. */
  applications: {
    jobId: string;
    appliedAt: string;
    note: string;
    profile: unknown;
    seenAt: string | null;
    decision: string | null;
  }[];
  /** Interviews on those applications (#103): the times offered and the answers. */
  interviews: {
    jobId: string;
    status: string;
    slots: string[];
    callFirst: boolean;
    mode: string | null;
    place: string;
    note: string;
    chosenSlot: string | null;
    reply: string;
    invitedAt: string;
    respondedAt: string | null;
  }[];
  /** The 中英文简历 share link (#86): its id and the page it shows. */
  resumeShare: { id: string; resume: unknown; createdAt: string; updatedAt: string } | null;
  /** 我的主页 as the account keeps it (#104): what the person filled in, and when it was last saved. */
  seekerProfile: { profile: unknown; updatedAt: string } | null;
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
  /** Job alerts (#53): saved searches (`section` for 实习 and 专业职位, #131), and the new jobs they found. */
  jobAlerts: { name: string; query: string; section: string | null; paused: boolean; createdAt: string }[];
  jobAlertHits: { jobId: string; alertName: string; createdAt: string }[];
  externalJobAlertHits: { externalJobId: string; alertName: string; createdAt: string }[];
  /** Jobs whose public contact details this account looked at. */
  contactViews: { jobId: string; viewedAt: string }[];
  /** Each call to the AI 发帖 model (#102): when, which model, its tokens and how it ended. */
  aiUsage: AiUsageRow[];
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
  const sharedChats = await listSharedConversations({ side: "seeker", email: address });
  const saved = await db
    .select()
    .from(t.savedJobs)
    .where(eq(t.savedJobs.email, address))
    .orderBy(asc(t.savedJobs.savedAt));
  const savedExternal = await db
    .select()
    .from(t.savedExternalJobs)
    .where(eq(t.savedExternalJobs.email, address))
    .orderBy(asc(t.savedExternalJobs.savedAt));
  const applications = await db
    .select()
    .from(t.jobApplications)
    .where(eq(t.jobApplications.seekerEmail, address))
    .orderBy(asc(t.jobApplications.appliedAt));
  const interviewRows = applications.length
    ? await db
        .select()
        .from(t.interviews)
        .where(
          inArray(
            t.interviews.applicationId,
            applications.map((a) => a.id),
          ),
        )
        .orderBy(asc(t.interviews.createdAt))
    : [];
  const [share] = await db.select().from(t.resumeShares).where(eq(t.resumeShares.email, address));
  const [page] = await db.select().from(t.seekerProfiles).where(eq(t.seekerProfiles.email, address));
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
  const invites = await db
    .select()
    .from(t.teamInvites)
    .where(or(eq(t.teamInvites.email, address), eq(t.teamInvites.invitedByEmail, address)))
    .orderBy(asc(t.teamInvites.createdAt));
  const hits = await db
    .select()
    .from(t.jobAlertHits)
    .where(eq(t.jobAlertHits.email, address))
    .orderBy(asc(t.jobAlertHits.createdAt));
  const externalHits = await db
    .select()
    .from(t.externalJobAlertHits)
    .where(eq(t.externalJobAlertHits.email, address))
    .orderBy(asc(t.externalJobAlertHits.createdAt));
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
    team: account.employerId
      ? { role: account.teamRole ?? "admin", name: account.teamName, joinedAt: account.teamJoinedAt }
      : null,
    teamInvites: invites.map((i) => ({
      employerId: i.employerId,
      role: i.role,
      received: i.email === address,
      status: i.status,
      createdAt: i.createdAt,
    })),
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
    sharedChats,
    savedJobs: saved.map((s) => ({ jobId: s.jobId, savedAt: s.savedAt, stage: s.stage, stageSetAt: s.stageSetAt })),
    savedExternalJobs: savedExternal.map((s) => ({
      externalJobId: s.externalJobId,
      savedAt: s.savedAt,
      stage: s.stage,
      stageSetAt: s.stageSetAt,
    })),
    applications: applications.map((a) => ({
      jobId: a.jobId,
      appliedAt: a.appliedAt,
      note: a.note,
      profile: a.profile,
      seenAt: a.seenAt,
      decision: a.decision,
    })),
    interviews: interviewRows.map((row) => ({
      jobId: applications.find((a) => a.id === row.applicationId)!.jobId,
      status: row.status,
      slots: row.slots,
      callFirst: row.callFirst,
      mode: row.mode,
      place: row.place,
      note: row.note,
      chosenSlot: row.chosenSlot,
      reply: row.reply,
      invitedAt: row.invitedAt,
      respondedAt: row.respondedAt,
    })),
    resumeShare: share
      ? { id: share.id, resume: share.resume, createdAt: share.createdAt, updatedAt: share.updatedAt }
      : null,
    seekerProfile: page ? { profile: page.profile, updatedAt: page.updatedAt } : null,
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
    jobAlerts: alerts.map((a) => ({
      name: a.name,
      query: a.query,
      section: a.section,
      paused: a.paused,
      createdAt: a.createdAt,
    })),
    jobAlertHits: hits.map((h) => ({ jobId: h.jobId, alertName: h.alertName, createdAt: h.createdAt })),
    externalJobAlertHits: externalHits.map((h) => ({
      externalJobId: h.externalJobId,
      alertName: h.alertName,
      createdAt: h.createdAt,
    })),
    contactViews: views.map((v) => ({ jobId: v.jobId, viewedAt: v.viewedAt })),
    aiUsage: await listAiUsageOf(address),
    sessions: sessions.map((s) => ({ activeRole: s.activeRole, createdAt: s.createdAt, expiresAt: s.expiresAt })),
  };
}

export type DeleteAccountResult = "deleted" | "no_account" | "last_moderator" | "last_team_admin";

/**
 * Deletes the account and everything that is only about it, in one transaction. The business's jobs come down and
 * lose their contact details, unless others in its team carry on (#87); records other people rely on stay, with the
 * email replaced. The last moderator cannot go (nobody could moderate), nor a team's last admin while the team has
 * others (nobody could run it). The caller ends the browser's session.
 */
export async function deleteAccount(email: string): Promise<DeleteAccountResult> {
  const address = normalizeEmail(email);
  const db = await database();
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(t.accounts).where(eq(t.accounts.email, address));
    if (!account) return "no_account";
    const teammates = account.employerId
      ? await tx
          .select({ role: t.accounts.teamRole })
          .from(t.accounts)
          .where(and(eq(t.accounts.employerId, account.employerId), ne(t.accounts.email, address)))
      : [];
    if (account.teamRole !== "member" && teammates.length && !teammates.some((m) => m.role === "admin"))
      return "last_team_admin";
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
    await tx.delete(t.savedExternalJobs).where(eq(t.savedExternalJobs.email, address));
    // Applications are the person's page and note: they go, and the employers' lists lose them (#84), with the
    // interviews on them (#103).
    const applicationIds = (
      await tx
        .select({ id: t.jobApplications.id })
        .from(t.jobApplications)
        .where(eq(t.jobApplications.seekerEmail, address))
    ).map((row) => row.id);
    if (applicationIds.length) await tx.delete(t.interviews).where(inArray(t.interviews.applicationId, applicationIds));
    await tx.delete(t.jobApplications).where(eq(t.jobApplications.seekerEmail, address));
    // The share link closes with the account (#86).
    await tx.delete(t.resumeShares).where(eq(t.resumeShares.email, address));
    await tx.delete(t.seekerProfiles).where(eq(t.seekerProfiles.email, address));
    await tx.delete(t.jobAlerts).where(eq(t.jobAlerts.email, address));
    await tx.delete(t.jobAlertHits).where(eq(t.jobAlertHits.email, address));
    await tx.delete(t.externalJobAlertHits).where(eq(t.externalJobAlertHits.email, address));
    // Invitations to this account go with it; ones it sent stay as the team's record, without its email (#87).
    await tx.delete(t.teamInvites).where(eq(t.teamInvites.email, address));
    await tx
      .update(t.teamInvites)
      .set({ invitedByEmail: DELETED_ACCOUNT })
      .where(eq(t.teamInvites.invitedByEmail, address));
    await tx
      .update(t.contactViews)
      .set({ viewerEmail: DELETED_ACCOUNT })
      .where(eq(t.contactViews.viewerEmail, address));
    // The calls to the AI 发帖 model stay in 审核数据's totals, without the email (#102).
    await tx.update(t.aiUsage).set({ email: DELETED_ACCOUNT }).where(eq(t.aiUsage.email, address));
    await tx
      .update(t.jobChatStarts)
      .set({ seekerEmail: DELETED_ACCOUNT })
      .where(eq(t.jobChatStarts.seekerEmail, address));

    // The job seeker's chats with businesses (#110) go with their messages and exchanges, both sides'. So do the
    // business's, below, when nobody in its team carries on.
    const conversations = await tx
      .select({ id: t.conversations.id })
      .from(t.conversations)
      .where(
        account.employerId && !teammates.length
          ? or(eq(t.conversations.seekerEmail, address), eq(t.conversations.employerId, account.employerId))
          : eq(t.conversations.seekerEmail, address),
      );
    if (conversations.length) {
      const ids = conversations.map((c) => c.id);
      await tx.delete(t.messages).where(inArray(t.messages.conversationId, ids));
      await tx.delete(t.exchanges).where(inArray(t.exchanges.conversationId, ids));
      await tx.delete(t.conversations).where(inArray(t.conversations.id, ids));
    }

    // The business stays (reports and the moderation log name it, and a ban must outlive the account). When nobody
    // else in its team carries on, nobody posts for it any more: its jobs come down and the contact details on them,
    // the person's own, are cleared, and invitations nobody answered are cancelled (#87).
    if (account.employerId && !teammates.length) {
      // The business's shared chats (#87) were only ever this person's side of the conversations.
      await tx.delete(t.teamChats).where(eq(t.teamChats.employerId, account.employerId));
      await tx
        .update(t.teamInvites)
        .set({ status: "cancelled" })
        .where(and(eq(t.teamInvites.employerId, account.employerId), eq(t.teamInvites.status, "pending")));
      await tx
        .update(t.jobs)
        .set({ status: "removed", contact: {}, contactPublic: false })
        .where(eq(t.jobs.employerId, account.employerId));
    }

    await tx.delete(t.accounts).where(eq(t.accounts.email, address));
    return "deleted";
  });
}
