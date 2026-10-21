import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { memoryChatStore, setChatServerStoreForTests } from "@/lib/chat-server/store";
import { ensureAccount, openEmployerIdentity } from "@/lib/data";
import { resetDatabaseForTests } from "@/db/ready";
import { openSharedConversation } from "@/db/conversations";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { decideMyChatCandidate, getMyApplicationCounts, getMyChatCandidate, getMyJobApplicants } =
  await import("@/app/[lang]/employer/applicant-actions");
const { inviteMyApplicant } = await import("@/app/[lang]/employer/interview-actions");
const { myAppliedJobIds, myApplicationViews } = await import("@/app/[lang]/jobs/[id]/apply-actions");
const { answerMyInterview } = await import("@/app/[lang]/me/interview-actions");
const { myAlertNotifications } = await import("@/app/[lang]/me/alerts/actions");
const { changeMyChat, myChat } = await import("@/app/[lang]/messages/actions");
const { saveMyProfile } = await import("@/app/[lang]/profile/actions");

/** 茶语轩 (e2) is one account's business; j4 is its job. */
const BOSS = "chatted.boss@example.com";
const SEEKER = "chatted.seeker@example.com";
const SOON = new Date(Date.now() + 3 * 86_400_000).toISOString();

async function signedIn(email: string, role: "seeker" | "employer" = "seeker") {
  cookies.clear();
  await ensureAccount(email);
  if (role === "employer") await openEmployerIdentity(email, "e2");
  await createSession(email, role, jar);
}

/** The job seeker opens 立即沟通 on j4; returns the conversation's id on their side. */
async function openChat() {
  await signedIn(SEEKER);
  const opened = (await changeMyChat({ type: "open", conversation: { kind: "employer", jobId: "j4" } }))?.opened;
  expect(opened).toBe("employer:e2:j4");
  return opened!;
}

/** The business's id for its conversation with the job seeker about j4. */
async function bossConversation() {
  await signedIn(BOSS, "employer");
  return (await myChat())!.record.extra.find((c) => c.job === "j4")!.id;
}

beforeEach(() => {
  resetDatabaseForTests();
  setAuthStoreForTests();
  setChatServerStoreForTests(memoryChatStore());
  cookies.clear();
});

describe("聊过这个职位的人 (ADR 0030)", () => {
  it("lists a job seeker once a message about the job is sent, with the chat's name and no page or note", async () => {
    const seekerId = await openChat();
    await saveMyProfile({ name: "陈小雨", availability: "周末" });
    await signedIn(BOSS, "employer");
    expect((await getMyJobApplicants("j4"))!.applicants).toEqual([]); // opening alone says nothing

    await signedIn(SEEKER);
    await changeMyChat({ type: "send", conversationId: seekerId, text: "你好，还招人吗？" });
    await changeMyChat({ type: "send", conversationId: seekerId, text: "周末可以" });

    await signedIn(BOSS, "employer");
    const [one, ...rest] = (await getMyJobApplicants("j4"))!.applicants;
    expect(rest).toEqual([]);
    expect(one).toMatchObject({
      source: "chat",
      name: "陈小雨",
      note: null,
      profile: null,
      facts: [],
      isNew: false,
      decision: null,
    });
    expect(JSON.stringify(one)).not.toMatch(/chatted\.seeker/);
    // Seen when made: not a 新申请, and no 申请 notice (the chat says it already).
    expect((await getMyApplicationCounts()).j4).toEqual({ total: 1, unseen: 0 });
    expect((await myAlertNotifications())!.items.filter((n) => n.type === "申请")).toEqual([]);

    // Not 已申请 on the job's row; listed in 我的申请 as 聊过.
    await signedIn(SEEKER);
    expect(await myAppliedJobIds()).toEqual([]);
    expect((await myApplicationViews())!).toMatchObject([{ jobId: "j4", source: "chat", note: null, status: "聊过" }]);
  });

  it("marks 合适 and 已录用 from the chat; 已录用 tells the job seeker", async () => {
    const seekerId = await openChat();
    await changeMyChat({ type: "send", conversationId: seekerId, text: "你好" });
    const chatId = await bossConversation();
    expect(await getMyChatCandidate(chatId)).toEqual({ decision: null });

    expect(await decideMyChatCandidate(chatId, "fit")).toBe(true);
    expect(await getMyChatCandidate(chatId)).toEqual({ decision: "fit" });
    expect((await getMyJobApplicants("j4"))!.applicants[0].decision).toBe("fit");
    expect(await decideMyChatCandidate(chatId, "maybe")).toBe(false);
    expect(await decideMyChatCandidate(chatId, "hired")).toBe(true);

    await signedIn(SEEKER);
    expect((await myApplicationViews())![0]).toMatchObject({ status: "已录用", stage: "ended" });
    const hired = (await myAlertNotifications())!.items.find((n) => n.id.startsWith("hired:"));
    expect(hired?.title).toMatch(/录用了你$/);

    // Another business, or the job seeker, gets nothing.
    expect(await getMyChatCandidate(chatId)).toBeUndefined();
    expect(await decideMyChatCandidate(chatId, "unfit")).toBe(false);
    await ensureAccount("chatted.other@example.com");
    await openEmployerIdentity("chatted.other@example.com", "e3");
    cookies.clear();
    await createSession("chatted.other@example.com", "employer", jar);
    expect(await getMyChatCandidate(chatId)).toBeUndefined();
    expect(await decideMyChatCandidate(chatId, "unfit")).toBe(false);
    expect(await getMyChatCandidate("employer:e2:j4")).toBeUndefined();
  });

  it("a mark before anything is said makes the row; an interview on it can be answered", async () => {
    await signedIn(SEEKER);
    await saveMyProfile({ name: "陈小雨" });
    await signedIn(BOSS, "employer");
    // An empty conversation is visible only to its initiator, so the business starts this one.
    await openSharedConversation({ seekerEmail: SEEKER, employerId: "e2", jobId: "j4", startedBy: "employer" });
    const chatId = await bossConversation();
    expect(await getMyChatCandidate(chatId)).toEqual({ decision: null });
    expect((await getMyJobApplicants("j4"))!.applicants).toEqual([]);
    expect(await decideMyChatCandidate(chatId, "fit")).toBe(true);
    const [one] = (await getMyJobApplicants("j4"))!.applicants;
    expect(one).toMatchObject({ source: "chat", decision: "fit" });

    expect(await inviteMyApplicant(one.id, { slots: [SOON] })).toMatchObject({ ok: true });
    await signedIn(SEEKER);
    expect((await myApplicationViews())![0].interview).toMatchObject({ status: "proposed" });
    expect(await answerMyInterview("j4", { kind: "confirm", slot: SOON })).toMatchObject({ ok: true });
    await signedIn(BOSS, "employer");
    const replies = (await myAlertNotifications())!.items.filter((n) => n.type === "面试");
    expect(replies.map((n) => n.title).join()).toContain("陈小雨");
  });
});
