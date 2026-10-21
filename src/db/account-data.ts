// A person's own data (#54, R-30): everything the server keeps about an account, for 导出我的数据, and deleting the
// account. What is deleted, what is kept without the person in it, and why: docs/adr/0009-account-deletion.md.
// Server only.
import type { Lang } from "@/i18n/lang";
import { and, asc, count, eq, inArray, ne, or, sql } from "drizzle-orm";
import { listAiUsageOf, type AiUsageRow } from "@/db/ai-usage";
import { listSharedConversations } from "@/db/conversations";
import { listRenewals, type JobRenewal } from "@/db/job-renewals";
import { guardedBatch } from "@/db/guarded-batch";
import { inList } from "@/db/in-list";
import { unchangedMembership } from "@/db/team-state";
import { CHANGED, keptChanging, untilSettled } from "@/db/optimistic";
import { database } from "@/db/ready";
import { toEmployer, toJob } from "@/db/rows";
import * as t from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import type { SharedConversation } from "@/lib/chat-server/shared-view";
import type { EmployerPage } from "@/components/employer/employer-page";
import { listJobContactsBy, listJobsPostedBy } from "@/db/job-posters";
import { imageKeysOf, listEvidenceOf, removeImages } from "@/db/report-evidence";

/** Who applied for 企业验证, once their account is deleted. */
const DELETED_CONTACT = "（已删除的账号）";
import type { AccountRole, Employer, Job } from "@/lib/types";

/** The server's part of the export. The browser adds what it keeps itself (profiles, reports sent, jobs viewed). */
export interface ServerAccountData {
  account: { email: string; createdAt: string; lastRole: AccountRole; lang: Lang | null };
  /** The account's place in its business's team (#87): role, the name the team sees, since when. */
  team: { role: string; name: string | null; joinedAt: string | null } | null;
  /** Team invitations this account received or sent (#87), whatever their status. */
  teamInvites: { employerId: string; role: string; received: boolean; status: string; createdAt: string }[];
  /**
   * Invitation links this account made or joined with (#349, ADR 0028), whatever their status. No token: only its
   * hash is stored, and that is not the person's to keep.
   */
  teamLinks: { employerId: string; made: boolean; status: string; createdAt: string; usedAt: string | null }[];
  moderator: { grantedAt: string; grantedBy: string | null } | null;
  /** The moderation decisions this account made as a moderator (#60). */
  moderationActions: { id: string; at: string; action: string; jobId: string | null; employerId: string | null }[];
  /** Whose personal information /admin showed this account as a moderator (#336): when, which kind, which record. */
  personalInfoViews: { at: string; kind: string; subjectId: string }[];
  /** The evidence this account attached to job reports (ADR 0027): chat messages as reported, screenshots by format. */
  reportEvidence: Awaited<ReturnType<typeof listEvidenceOf>>;
  /**
   * The business of the employer identity, every job it posted whatever their status, and their renewals (#69); its
   * 企业主页 (ADR 0022), and whether this account saved it last.
   */
  employer: {
    business: Employer;
    jobs: Job[];
    renewals: JobRenewal[];
    page: { page: EmployerPage; updatedAt: string; savedByYou: boolean } | null;
  } | null;
  /** The jobs this account posted (#182), in whichever business; the jobs themselves are under `employer`. */
  jobsPosted: { jobId: string; employerId: string; postedAt: string }[];
  /** The jobs whose contact details this account changed last (#186); the details are on the jobs. */
  jobContactsChanged: { jobId: string; employerId: string }[];
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
  /**
   * Jobs this account applied for (#84), with the note and the page sent, or chatted about ('chat', no note or page,
   * ADR 0030), and what the employer did.
   */
  applications: {
    jobId: string;
    source: string;
    appliedAt: string;
    note: string | null;
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
  const shown = await db
    .select({ at: t.personalInfoViews.at, kind: t.personalInfoViews.kind, subjectId: t.personalInfoViews.subjectId })
    .from(t.personalInfoViews)
    .where(eq(t.personalInfoViews.moderator, address))
    .orderBy(asc(t.personalInfoViews.at), asc(t.personalInfoViews.id));
  const [business] = account.employerId
    ? await db.select().from(t.employers).where(eq(t.employers.id, account.employerId))
    : [];
  const jobs = business
    ? await db.select().from(t.jobs).where(eq(t.jobs.employerId, business.id)).orderBy(asc(t.jobs.postedAt))
    : [];
  const renewals = await listRenewals(jobs.map((j) => j.id));
  const jobsPosted = await listJobsPostedBy(address);
  const jobContactsChanged = await listJobContactsBy(address);
  const [businessPage] = business
    ? await db.select().from(t.employerProfiles).where(eq(t.employerProfiles.employerId, business.id))
    : [];
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
          inList(
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
  const links = await db
    .select()
    .from(t.teamInviteLinks)
    .where(or(eq(t.teamInviteLinks.createdByEmail, address), eq(t.teamInviteLinks.usedByEmail, address)))
    .orderBy(asc(t.teamInviteLinks.createdAt));
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
    account: {
      email: account.email,
      createdAt: account.createdAt,
      lastRole: account.lastRole,
      lang: account.lang ?? null,
    },
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
    teamLinks: links.map((l) => ({
      employerId: l.employerId,
      made: l.createdByEmail === address,
      status: l.status,
      createdAt: l.createdAt,
      usedAt: l.usedAt,
    })),
    moderator: moderator ? { grantedAt: moderator.grantedAt, grantedBy: moderator.grantedBy } : null,
    moderationActions: actions.map((a) => ({
      id: a.id,
      at: a.at,
      action: a.action,
      jobId: a.jobId,
      employerId: a.employerId,
    })),
    personalInfoViews: shown,
    reportEvidence: await listEvidenceOf(address),
    employer: business
      ? {
          business: toEmployer(business),
          jobs: jobs.map(toJob),
          renewals,
          page: businessPage
            ? {
                page: businessPage.page,
                updatedAt: businessPage.updatedAt,
                savedByYou: businessPage.updatedByEmail === address,
              }
            : null,
        }
      : null,
    jobsPosted,
    jobContactsChanged,
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
      source: a.source,
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
  // Report screenshots' files go once their rows have (ADR 0027): a failed transaction leaves both.
  const images = await imageKeysOf(address);
  const result = await untilSettled<DeleteAccountResult>(
    async () => {
      const [account] = await db.select().from(t.accounts).where(eq(t.accounts.email, address));
      if (!account) return "no_account";
      const membership = account.employerId ? await unchangedMembership(db, account.employerId) : sql`true`;
      const teammates = account.employerId
        ? await db
            .select({ role: t.accounts.teamRole })
            .from(t.accounts)
            .where(and(eq(t.accounts.employerId, account.employerId), ne(t.accounts.email, address)))
        : [];
      if (account.teamRole !== "member" && teammates.length && !teammates.some((m) => m.role === "admin"))
        return "last_team_admin";
      const [moderator] = await db.select().from(t.moderators).where(eq(t.moderators.email, address));
      if (moderator) {
        const [{ n }] = await db.select({ n: count() }).from(t.moderators);
        if (n <= 1) return "last_moderator";
      }
      const condition = sql`${membership} and exists (
      select 1 from ${t.accounts} where ${t.accounts.email} = ${address}
      and ${t.accounts.employerId} is ${account.employerId} and ${t.accounts.teamRole} is ${account.teamRole}
    ) and (not exists (select 1 from ${t.moderators} where ${t.moderators.email} = ${address})
      or (select count(*) from ${t.moderators}) > 1)`;
      const ownChats =
        account.employerId && !teammates.length
          ? or(eq(t.conversations.seekerEmail, address), eq(t.conversations.employerId, account.employerId))!
          : eq(t.conversations.seekerEmail, address);
      const chats = db.select({ id: t.conversations.id }).from(t.conversations).where(ownChats);
      const applications = db
        .select({ id: t.jobApplications.id })
        .from(t.jobApplications)
        .where(eq(t.jobApplications.seekerEmail, address));
      const { applied } = await guardedBatch(db, condition, (allowed) => [
        db.delete(t.moderators).where(and(eq(t.moderators.email, address), allowed)),
        db
          .update(t.moderators)
          .set({ grantedBy: DELETED_ACCOUNT })
          .where(and(eq(t.moderators.grantedBy, address), allowed)),
        db
          .update(t.moderationLog)
          .set({ moderator: DELETED_ACCOUNT })
          .where(and(eq(t.moderationLog.moderator, address), allowed)),
        db
          .update(t.personalInfoViews)
          .set({ moderator: DELETED_ACCOUNT })
          .where(and(eq(t.personalInfoViews.moderator, address), allowed)),
        db
          .update(t.verificationRequests)
          .set({ status: "withdrawn" })
          .where(
            and(
              eq(t.verificationRequests.submittedByEmail, address),
              eq(t.verificationRequests.status, "pending"),
              allowed,
            ),
          ),
        db
          .update(t.verificationRequests)
          .set({ submittedByEmail: DELETED_ACCOUNT, contactName: DELETED_CONTACT })
          .where(and(eq(t.verificationRequests.submittedByEmail, address), allowed)),
        db
          .update(t.verificationRequests)
          .set({ decidedByEmail: DELETED_ACCOUNT })
          .where(and(eq(t.verificationRequests.decidedByEmail, address), allowed)),
        // Delete children by subquery: newly opened chats/applications are included and large accounts need no ID list.
        db.delete(t.reportEvidence).where(and(eq(t.reportEvidence.reporterEmail, address), allowed)),
        db.delete(t.sessions).where(and(eq(t.sessions.email, address), allowed)),
        db.delete(t.signInCodes).where(and(eq(t.signInCodes.email, address), allowed)),
        db.delete(t.chatRecords).where(and(eq(t.chatRecords.email, address), allowed)),
        db.delete(t.savedJobs).where(and(eq(t.savedJobs.email, address), allowed)),
        db.delete(t.savedExternalJobs).where(and(eq(t.savedExternalJobs.email, address), allowed)),
        db.delete(t.interviews).where(and(inArray(t.interviews.applicationId, applications), allowed)),
        db.delete(t.jobApplications).where(and(eq(t.jobApplications.seekerEmail, address), allowed)),
        db.delete(t.resumeShares).where(and(eq(t.resumeShares.email, address), allowed)),
        db.delete(t.seekerProfiles).where(and(eq(t.seekerProfiles.email, address), allowed)),
        db.delete(t.jobAlerts).where(and(eq(t.jobAlerts.email, address), allowed)),
        db.delete(t.jobAlertHits).where(and(eq(t.jobAlertHits.email, address), allowed)),
        db.delete(t.externalJobAlertHits).where(and(eq(t.externalJobAlertHits.email, address), allowed)),
        db.delete(t.teamInvites).where(and(eq(t.teamInvites.email, address), allowed)),
        db
          .update(t.teamInvites)
          .set({ invitedByEmail: DELETED_ACCOUNT })
          .where(and(eq(t.teamInvites.invitedByEmail, address), allowed)),
        db
          .update(t.teamInviteLinks)
          .set({ createdByEmail: DELETED_ACCOUNT })
          .where(and(eq(t.teamInviteLinks.createdByEmail, address), allowed)),
        db
          .update(t.teamInviteLinks)
          .set({ usedByEmail: DELETED_ACCOUNT })
          .where(and(eq(t.teamInviteLinks.usedByEmail, address), allowed)),
        db
          .update(t.contactViews)
          .set({ viewerEmail: DELETED_ACCOUNT })
          .where(and(eq(t.contactViews.viewerEmail, address), allowed)),
        db
          .update(t.jobs)
          .set({ postedBy: DELETED_ACCOUNT })
          .where(and(eq(t.jobs.postedBy, address), allowed)),
        db
          .update(t.jobs)
          .set({ contactBy: DELETED_ACCOUNT })
          .where(and(eq(t.jobs.contactBy, address), allowed)),
        db
          .update(t.employerProfiles)
          .set({ updatedByEmail: DELETED_ACCOUNT })
          .where(and(eq(t.employerProfiles.updatedByEmail, address), allowed)),
        db
          .update(t.aiUsage)
          .set({ email: DELETED_ACCOUNT })
          .where(and(eq(t.aiUsage.email, address), allowed)),
        db
          .update(t.jobChatStarts)
          .set({ seekerEmail: DELETED_ACCOUNT })
          .where(and(eq(t.jobChatStarts.seekerEmail, address), allowed)),
        db.delete(t.messages).where(and(inArray(t.messages.conversationId, chats), allowed)),
        db.delete(t.exchanges).where(and(inArray(t.exchanges.conversationId, chats), allowed)),
        db.delete(t.conversations).where(and(ownChats, allowed)),
        // When this was the last teammate, remove public information and revoke unused invitations atomically.
        ...(account.employerId && !teammates.length
          ? [
              db.delete(t.teamChats).where(and(eq(t.teamChats.employerId, account.employerId), allowed)),
              db.delete(t.employerProfiles).where(and(eq(t.employerProfiles.employerId, account.employerId), allowed)),
              db
                .update(t.teamInvites)
                .set({ status: "cancelled" })
                .where(
                  and(eq(t.teamInvites.employerId, account.employerId), eq(t.teamInvites.status, "pending"), allowed),
                ),
              db
                .update(t.teamInviteLinks)
                .set({ status: "revoked" })
                .where(
                  and(
                    eq(t.teamInviteLinks.employerId, account.employerId),
                    eq(t.teamInviteLinks.status, "open"),
                    allowed,
                  ),
                ),
              db
                .update(t.jobs)
                .set({ status: "removed", contact: {}, contactPublic: false })
                .where(and(eq(t.jobs.employerId, account.employerId), allowed)),
            ]
          : []),
        db.delete(t.accounts).where(and(eq(t.accounts.email, address), allowed)),
      ]);
      return applied ? "deleted" : CHANGED;
    },
    () => keptChanging("deleteAccount"),
  );
  if (result === "deleted") await removeImages(images);
  return result;
}
