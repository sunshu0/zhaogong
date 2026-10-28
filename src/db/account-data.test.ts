import { eq, getTableColumns, getTableName } from "drizzle-orm";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { deleteAccount, exportAccountData } from "@/db/account-data";
import { databaseAuthStore } from "@/db/auth-store";
import { databaseChatStore } from "@/db/chat-store";
import { grantModerator, isModerator, listModerators, revokeModerator } from "@/db/moderators";
import { database } from "@/db/ready";
import { createJobAlert, matchJobAlerts } from "@/db/job-alerts";
import { renewJob } from "@/db/job-renewals";
import { saveJob } from "@/db/saved-jobs";
import { saveExternalJob } from "@/db/saved-external-jobs";
import { matchExternalJobAlerts } from "@/db/external-job-alerts";
import { getExternalJob } from "@/db/external-jobs";
import { addApplication } from "@/db/job-applications";
import { saveResumeShare } from "@/db/resume-shares";
import { saveSeekerProfile } from "@/db/seeker-profiles";
import { getEmployerPage, saveEmployerPage } from "@/db/employer-profiles";
import { recordContactBy } from "@/db/job-posters";
import { listViews, recordViews } from "@/db/personal-info-views";
import { inviteToInterview } from "@/db/interviews";
import { addSharedMessage, openSharedConversation } from "@/db/conversations";
import { listAiUsageSince, recordAiUsage } from "@/db/ai-usage";
import { parseResumeDoc } from "@/components/seeker/resume-doc";
import { jobNumbers, recordChatStart } from "@/db/job-stats";
import * as t from "@/db/schema";
import { DEMO_MODERATOR } from "@/db/seed";
import {
  addModerationLog,
  listModerationLog,
  createEmployer,
  createJob,
  ensureAccount,
  getAccount,
  getJob,
  listContactViews,
  openEmployerIdentity,
  recordContactView,
} from "@/lib/data";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";
import type { Job } from "@/lib/types";
import { MOCK_JOBS } from "@/mock/data";
import type { ApplicationProfile } from "@/components/seeker/applications";

const APPLICATION_PAGE: ApplicationProfile = {
  name: "导出测试",
  headline: "",
  location: "市中心",
  languages: "普通话",
  availability: "周末",
  bio: "",
  resume: { skills: "", employmentTypes: [], regionIds: [] },
};

const scopeOf = (email: string, role: "seeker" | "employer", employerId: string | null = null) =>
  JSON.stringify([email, role, employerId]);

function jobFor(employerId: string): Omit<Job, "id"> {
  const job: Partial<Job> = { ...MOCK_JOBS[0] };
  delete job.id;
  return {
    ...(job as Omit<Job, "id">),
    employerId,
    titleZh: "删除账号测试职位",
    contactPublic: true,
    contact: { phone: "09 000 0000", email: "owner@example.com" },
    status: "active",
  };
}

/** An account with something in every table that holds its email. */
async function fullAccount(email: string) {
  await ensureAccount(email);
  const business = await createEmployer({ name: `测试店 ${email}`, regionId: "akl-central" });
  await openEmployerIdentity(email, business.id);
  const job = await createJob(jobFor(business.id), email);
  const auth = databaseAuthStore();
  await auth.insertSession({
    id: `session-${email}`,
    email,
    activeRole: "seeker",
    createdAt: "2026-10-16T00:00:00.000Z",
    expiresAt: "2026-11-16T00:00:00.000Z",
  });
  const db = await database();
  // Synthetic storage rows: wire/key validation is tested at the push boundary, not in this export fixture.
  await db.insert(t.pushSubscriptions).values({
    endpoint: `https://fcm.googleapis.com/fcm/send/${encodeURIComponent(email)}`,
    sessionId: `session-${email}`,
    email, role: "seeker", p256dh: "synthetic-public-key", auth: "synthetic-auth", lang: "en",
    createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z",
  });
  await db.insert(t.pushSetups).values({ sessionId: `session-${email}`, attemptedAt: "2026-10-17T00:00:00.000Z" });
  await auth.putCode({
    email,
    codeHash: "hash",
    expiresAt: "2026-10-16T00:10:00.000Z",
    attempts: 0,
    createdAt: "2026-10-16T00:00:00.000Z",
  });
  const chats = databaseChatStore();
  await chats.putNotificationReads(scopeOf(email, "seeker"), ["n1"]);
  await chats.putNotificationReads(scopeOf(email, "employer", business.id), ["n2"]);
  await recordContactView("j1", email);
  await saveJob(email, "j1");
  const application = await addApplication({
    email,
    jobId: "j1",
    employerId: "e1",
    note: "周末可以",
    profile: APPLICATION_PAGE,
  });
  if (application !== "already")
    await inviteToInterview("e1", application.id, INVITE, new Date("2026-10-17T00:00:00.000Z"));
  await saveResumeShare(email, RESUME, new Date("2026-10-17T00:00:00.000Z"));
  await saveSeekerProfile(email, { name: "王芳", bio: "会做咖啡" }, new Date("2026-10-17T00:00:00.000Z"));
  await saveEmployerPage(email, { bio: "测试店的介绍" }, new Date("2026-10-17T00:00:00.000Z"));
  await recordContactBy(job.id, email);
  await recordChatStart("j1", email);
  await createJobAlert(email, { name: "全部新职位", country: "NZ", query: "" }, new Date("2026-10-16T00:00:00.000Z"));
  await matchJobAlerts(await getJob("j2").then((j) => ({ ...j!, expiresAt: "2099-01-01T00:00:00.000Z" })));
  // 实习 and 专业职位 (#131): a saved external job, an alert on a section and what it found.
  await saveExternalJob(email, "demo-kowhai:4001", new Date("2026-10-17T00:00:00.000Z"));
  await createJobAlert(
    email,
    { name: "全部实习", country: "NZ", query: "", section: "internship" },
    new Date("2026-10-16T01:00:00.000Z"),
  );
  await matchExternalJobAlerts((await getExternalJob("demo-kowhai:4001"))!);
  await renewJob(job.id, { expiresAt: "2026-12-01T00:00:00.000Z", status: "active", days: 30 });
  await recordAiUsage(
    email,
    { model: "claude-sonnet-5-5", usage: AI_TOKENS, result: "ok" },
    new Date("2026-10-17T00:00:00.000Z"),
  );
  return { business, job };
}

const INVITE = { slots: ["2099-01-05T01:00:00.000Z"], callFirst: false, mode: null, place: "", note: "" };
const AI_TOKENS = { input: 1200, output: 300, cacheRead: 900, cacheWrite: 0 };
const RESUME = parseResumeDoc({ zh: { name: "林晓" } })!;

describe("exportAccountData (#54)", () => {
  it("has the account, the business and its jobs, chats, contact views and sessions, nothing of others", async () => {
    const email = "export.me@example.com";
    const { business, job } = await fullAccount(email);
    await fullAccount("someone.else@example.com");
    const data = await exportAccountData(" Export.Me@Example.com ");
    expect(data?.account).toMatchObject({ email, lastRole: "seeker" });
    expect(data?.moderator).toBeNull();
    expect(data?.pushSubscriptions).toEqual([{
      endpoint: `https://fcm.googleapis.com/fcm/send/${encodeURIComponent(email)}`,
      role: "seeker", p256dh: "synthetic-public-key", auth: "synthetic-auth", lang: "en",
      createdAt: "2026-10-17T00:00:00.000Z", updatedAt: "2026-10-17T00:00:00.000Z",
    }]);
    expect(data?.pushSetupAttempts).toEqual([{ attemptedAt: "2026-10-17T00:00:00.000Z" }]);
    expect(data?.employer?.business).toMatchObject({ id: business.id, name: business.name });
    expect(data?.employer?.jobs.map((j) => j.id)).toEqual([job.id]);
    expect(data?.employer?.renewals).toMatchObject([
      { jobId: job.id, days: 30, expiresAfter: "2026-12-01T00:00:00.000Z" },
    ]);
    expect(data?.jobsPosted).toEqual([{ jobId: job.id, employerId: business.id, postedAt: job.postedAt }]);
    expect(data?.jobContactsChanged).toEqual([{ jobId: job.id, employerId: business.id }]);
    // Who posted a job is the team's to know, never part of the job (#182).
    expect(data?.employer?.jobs[0]).not.toHaveProperty("postedBy");
    expect(data?.employer?.page).toEqual({
      page: { bio: "测试店的介绍" },
      updatedAt: "2026-10-17T00:00:00.000Z",
      savedByYou: true,
    });
    expect(data?.chats.map((c) => c.identity).sort()).toEqual(
      [scopeOf(email, "employer", business.id), scopeOf(email, "seeker")].sort(),
    );
    expect(data?.chats.find((c) => c.identity === scopeOf(email, "seeker"))?.notificationsRead).toEqual(["n1"]);
    expect(data?.savedJobs).toEqual([{ jobId: "j1", savedAt: expect.any(String), stage: null, stageSetAt: null }]);
    expect(data?.applications).toEqual([
      {
        jobId: "j1",
        source: "apply",
        appliedAt: expect.any(String),
        note: "周末可以",
        profile: APPLICATION_PAGE,
        seenAt: null,
        decision: null,
      },
    ]);
    expect(data?.interviews).toEqual([
      expect.objectContaining({
        jobId: "j1",
        status: "proposed",
        slots: INVITE.slots,
        invitedAt: "2026-10-17T00:00:00.000Z",
      }),
    ]);
    expect(data?.resumeShare).toEqual({
      id: expect.any(String),
      resume: RESUME,
      createdAt: "2026-10-17T00:00:00.000Z",
      updatedAt: "2026-10-17T00:00:00.000Z",
    });
    expect(data?.seekerProfile).toEqual({
      profile: { name: "王芳", bio: "会做咖啡" },
      updatedAt: "2026-10-17T00:00:00.000Z",
    });
    expect(data?.chatStarts).toEqual([{ jobId: "j1", startedAt: expect.any(String) }]);
    expect(data?.jobAlerts).toEqual([
      { name: "全部新职位", query: "", section: null, paused: false, createdAt: "2026-10-16T00:00:00.000Z" },
      { name: "全部实习", query: "", section: "internship", paused: false, createdAt: "2026-10-16T01:00:00.000Z" },
    ]);
    expect(data?.jobAlertHits).toEqual([{ jobId: "j2", alertName: "全部新职位", createdAt: expect.any(String) }]);
    expect(data?.savedExternalJobs).toEqual([
      { externalJobId: "demo-kowhai:4001", savedAt: "2026-10-17T00:00:00.000Z", stage: null, stageSetAt: null },
    ]);
    expect(data?.externalJobAlertHits).toEqual([
      { externalJobId: "demo-kowhai:4001", alertName: "全部实习", createdAt: expect.any(String) },
    ]);
    expect(data?.contactViews).toEqual([{ jobId: "j1", viewedAt: expect.any(String) }]);
    expect(data?.aiUsage).toEqual([
      { at: "2026-10-17T00:00:00.000Z", model: "claude-sonnet-5-5", ...AI_TOKENS, result: "ok" },
    ]);
    expect(data?.sessions).toEqual([
      { activeRole: "seeker", createdAt: "2026-10-16T00:00:00.000Z", expiresAt: "2026-11-16T00:00:00.000Z" },
    ]);
    expect(JSON.stringify(data)).not.toContain("someone.else@example.com");
    expect(JSON.stringify(data)).not.toContain("session-"); // the session id is never shown
  });

  it("is undefined for an email without an account", async () => {
    expect(await exportAccountData("never.signed.up@example.com")).toBeUndefined();
  });
});

describe("deleteAccount (#54)", () => {
  it("deletes the account and what is only about it; the business's jobs come down without contact details", async () => {
    const email = "delete.me@example.com";
    const { business, job } = await fullAccount(email);
    const other = await fullAccount("stays.here@example.com");
    const viewsBefore = (await listContactViews("j1")).length;
    const chatsBefore = (await jobNumbers(["j1"])).j1.chats;

    expect(await deleteAccount("Delete.Me@example.com")).toBe("deleted");

    expect(await getAccount(email)).toBeUndefined();
    expect(await exportAccountData(email)).toBeUndefined();
    const db = await database();
    for (const [table, column] of [
      [t.sessions, t.sessions.email],
      [t.pushSubscriptions, t.pushSubscriptions.email],
      [t.signInCodes, t.signInCodes.email],
      [t.chatRecords, t.chatRecords.email],
      [t.contactViews, t.contactViews.viewerEmail],
      [t.savedJobs, t.savedJobs.email],
      [t.jobApplications, t.jobApplications.seekerEmail],
      [t.resumeShares, t.resumeShares.email],
      [t.seekerProfiles, t.seekerProfiles.email],
      [t.jobAlerts, t.jobAlerts.email],
      [t.jobAlertHits, t.jobAlertHits.email],
      [t.savedExternalJobs, t.savedExternalJobs.email],
      [t.externalJobAlertHits, t.externalJobAlertHits.email],
      [t.aiUsage, t.aiUsage.email],
    ] as const) {
      expect(await db.select().from(table).where(eq(column, email))).toEqual([]);
    }
    expect(await db.select().from(t.pushSetups).where(eq(t.pushSetups.sessionId, `session-${email}`))).toEqual([]);
    expect(await db.select().from(t.pushSubscriptions).where(eq(t.pushSubscriptions.email, "stays.here@example.com"))).toHaveLength(1);
    expect(await db.select().from(t.pushSetups).where(eq(t.pushSetups.sessionId, "session-stays.here@example.com"))).toHaveLength(1);
    // The interviews on the person's applications went with them (#103); the other account's stays.
    expect(await db.select().from(t.interviews)).toHaveLength(
      (await db.select().from(t.jobApplications)).filter((a) => a.jobId === "j1").length,
    );
    // The view still counts for the job, without the viewer.
    const views = await listContactViews("j1");
    expect(views).toHaveLength(viewsBefore);
    expect(views.filter((v) => v.viewerEmail === DELETED_ACCOUNT).length).toBeGreaterThan(0);
    // So does the chat the person started.
    expect((await jobNumbers(["j1"])).j1.chats).toBe(chatsBefore);
    expect(await db.select().from(t.jobChatStarts).where(eq(t.jobChatStarts.seekerEmail, email))).toEqual([]);
    // The calls to the AI 发帖 model still count in 审核数据, without the email (#102).
    expect(await db.select().from(t.aiUsage).where(eq(t.aiUsage.email, DELETED_ACCOUNT))).not.toEqual([]);
    expect(await listAiUsageSince(new Date("2026-10-16T00:00:00.000Z"))).toContainEqual(
      expect.objectContaining({ input: 1200, result: "ok" }),
    );

    const removed = await getJob(job.id);
    expect(removed).toMatchObject({ status: "removed", contactPublic: false, contact: {} });
    const [postedRow] = await db.select().from(t.jobs).where(eq(t.jobs.id, job.id));
    expect(postedRow).toMatchObject({ postedBy: DELETED_ACCOUNT, contactBy: DELETED_ACCOUNT });
    // Nobody is left to keep the business's page (ADR 0022); the other business keeps its own.
    expect(await getEmployerPage(business.id)).toBeUndefined();
    expect((await getEmployerPage(other.business.id))?.updatedByEmail).toBe("stays.here@example.com");
    const [stillThere] = await db.select().from(t.employers).where(eq(t.employers.id, business.id));
    expect(stillThere?.name).toBe(business.name);

    // Someone else's data is untouched.
    expect(await getAccount("stays.here@example.com")).toBeDefined();
    expect(await getJob(other.job.id)).toMatchObject({ status: "active", contactPublic: true });
  });

  it("lets the same email sign up again as a new account", async () => {
    const email = "comes.back@example.com";
    await fullAccount(email);
    expect(await deleteAccount(email)).toBe("deleted");
    const again = await ensureAccount(email);
    expect(again.employerId).toBeUndefined();
    expect((await exportAccountData(email))?.employer).toBeNull();
  });

  it("is no_account for an email without an account", async () => {
    expect(await deleteAccount("nobody.here@example.com")).toBe("no_account");
  });

  it("never deletes the last moderator; another moderator goes, and who they added no longer names them", async () => {
    const first = "mod.one@example.com";
    const second = "mod.two@example.com";
    await ensureAccount(first);
    await ensureAccount(second);
    await grantModerator(first, null);
    await grantModerator(second, first);
    const decision = await addModerationLog({ action: "dismiss", jobId: "j2", moderator: first });
    expect((await exportAccountData(first))?.moderationActions).toEqual([
      { id: decision.id, at: decision.at, action: "dismiss", jobId: "j2", employerId: null },
    ]);
    const seen = new Date("2026-10-20T01:02:03Z");
    await recordViews(first, "verification", ["vr-export"], seen);
    expect((await exportAccountData(first))?.personalInfoViews).toEqual([
      { at: "2026-10-20T01:02:03Z", kind: "verification", subjectId: "vr-export" },
    ]);
    // ADR 0043: the record of moderator changes, where the account is either side.
    expect((await exportAccountData(first))?.moderatorChanges).toMatchObject([
      { action: "grant", email: first, by: null },
      { action: "grant", email: second, by: first },
    ]);

    expect(await deleteAccount(first)).toBe("deleted");
    const { listModeratorChanges } = await import("@/db/moderators");
    expect(JSON.stringify(await listModeratorChanges())).not.toContain(first);
    expect(await isModerator(first)).toBe(false);
    expect((await listModerators()).find((m) => m.email === second)?.grantedBy).toBe(DELETED_ACCOUNT);
    // The decision stays, without the email (#60).
    const kept = (await listModerationLog()).find((e) => e.id === decision.id);
    expect(kept).toMatchObject({ action: "dismiss", moderator: DELETED_ACCOUNT });
    expect(JSON.stringify(await listModerationLog())).not.toContain(first);
    // So does the record of what it was shown (#336), without the email.
    const { views } = await listViews({ days: 7 }, seen);
    expect(views.filter((v) => v.subjectId === "vr-export")).toEqual([
      { at: "2026-10-20T01:02:03Z", moderator: DELETED_ACCOUNT, kind: "verification", subjectId: "vr-export" },
    ]);

    // Leave `second` as the only moderator.
    for (const m of await listModerators()) if (m.email !== second) await revokeModerator(m.email);
    expect(await deleteAccount(second)).toBe("last_moderator");
    expect(await getAccount(second)).toBeDefined();
    expect(await isModerator(second)).toBe(true);
    await grantModerator(DEMO_MODERATOR, null);
  });

  it("covers every column that holds an email: a new one must be added to the export and the deletion", () => {
    const handled = new Set([
      "accounts.email",
      "sessions.email",
      "push_subscriptions.email",
      "sign_in_codes.email",
      "chat_records.email",
      "contact_views.viewer_email",
      "saved_jobs.email",
      "job_applications.seeker_email",
      "resume_shares.email",
      "seeker_profiles.email",
      "employer_profiles.updated_by_email",
      "jobs.posted_by_email",
      "jobs.contact_by_email",
      "job_chat_starts.seeker_email",
      "job_alerts.email",
      "job_alert_hits.email",
      "saved_external_jobs.email",
      "external_job_alert_hits.email",
      "moderation_log.moderator_email",
      "personal_info_views.moderator_email",
      "report_evidence.reporter_email",
      "moderators.email",
      "moderator_changes.email",
      "moderator_chats.opened_by_email",
      "moderator_chat_messages.sender_email",
      "conversations.seeker_email",
      "verification_requests.submitted_by_email",
      "verification_requests.decided_by_email",
      "team_invites.email",
      "team_invites.invited_by_email",
      "team_invite_links.created_by_email",
      "team_invite_links.used_by_email",
      "ai_usage.email",
    ]);
    const found = Object.values(t as Record<string, unknown>)
      .filter((value): value is SQLiteTable => value instanceof SQLiteTable)
      .flatMap((table) =>
        Object.values(getTableColumns(table))
          .filter((column) => column.name.includes("email"))
          .map((column) => `${getTableName(table)}.${column.name}`),
      );
    expect(new Set(found)).toEqual(handled);
  });
});

describe("chats both sides share (#110)", () => {
  async function chat(seeker: string, employerId: string, jobId: string) {
    await ensureAccount(seeker);
    const row = await openSharedConversation({ seekerEmail: seeker, employerId, jobId, startedBy: "seeker" });
    await addSharedMessage(row.id, "seeker", "你好", undefined);
    await addSharedMessage(row.id, "employer", "你好，请问哪天有空？", "王经理");
    return row;
  }
  const rows = async (id: string) => {
    const db = await database();
    return {
      conversations: await db.select().from(t.conversations).where(eq(t.conversations.id, id)),
      messages: await db.select().from(t.messages).where(eq(t.messages.conversationId, id)),
    };
  };

  it("are in the job seeker's export with both sides' messages, and go when the job seeker goes", async () => {
    const business = await createEmployer({ name: "导出聊天的店", regionId: "akl-cbd" });
    const job = await createJob(jobFor(business.id));
    const row = await chat("shared.export@example.com", business.id, job.id);

    const data = await exportAccountData("shared.export@example.com");
    expect(data?.sharedChats).toEqual([
      expect.objectContaining({
        employerName: "导出聊天的店",
        messages: [
          expect.objectContaining({ from: "seeker", text: "你好" }),
          expect.objectContaining({ from: "employer", text: "你好，请问哪天有空？", byName: "王经理" }),
        ],
      }),
    ]);

    expect(await deleteAccount("shared.export@example.com")).toBe("deleted");
    expect(await rows(row.id)).toEqual({ conversations: [], messages: [] });
  });

  it("go with the business when the last person in its team goes, not before", async () => {
    const business = await createEmployer({ name: "最后一个人的店", regionId: "akl-cbd" });
    const job = await createJob(jobFor(business.id));
    await ensureAccount("last.boss@example.com");
    await openEmployerIdentity("last.boss@example.com", business.id);
    const row = await chat("talks.to.last@example.com", business.id, job.id);
    const db = await database();
    await db.insert(t.accounts).values({
      email: "last.staff@example.com",
      createdAt: "2026-10-17",
      employerId: business.id,
      teamRole: "member",
    });

    expect(await deleteAccount("last.staff@example.com")).toBe("deleted");
    expect((await rows(row.id)).messages).toHaveLength(2);
    expect(await deleteAccount("last.boss@example.com")).toBe("deleted");
    expect(await rows(row.id)).toEqual({ conversations: [], messages: [] });
    expect(await getAccount("talks.to.last@example.com")).toBeDefined();
  });
});
