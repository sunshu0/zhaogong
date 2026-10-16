import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { memoryChatStore, setChatServerStoreForTests } from "@/lib/chat-server/store";
import { notificationHref } from "@/components/seeker/hub-state";
import { ensureAccount, openEmployerIdentity } from "@/lib/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { applyForJob, myApplicationViews, withdrawMyApplication } = await import("@/app/jobs/[id]/apply-actions");
const { getMyJobApplicants } = await import("@/app/employer/applicant-actions");
const { cancelMyApplicantInterview, inviteMyApplicant } = await import("@/app/employer/interview-actions");
const { answerMyInterview, myInterviewTodos } = await import("@/app/me/interview-actions");
const { myAlertNotifications } = await import("@/app/me/alerts/actions");
const { markMyNotificationsRead } = await import("@/app/messages/actions");

const PAGE = {
  name: "林晓",
  headline: "",
  location: "",
  languages: "",
  availability: "周末",
  bio: "",
  privateDetails: { phone: "09 055 0101", wechat: "linxiao", email: "lin.private@example.com" },
  resume: { discoverable: false, skills: "", employmentTypes: ["part_time"], regionIds: [] },
};
/** 川味小馆 (e1) is one account's business, so every test invites as it. */
const BOSS = "interview.boss@example.com";
const SOON = new Date(Date.now() + 3 * 86_400_000).toISOString();
const LATER = new Date(Date.now() + 5 * 86_400_000).toISOString();

async function signedIn(email: string, role: "seeker" | "employer" = "seeker") {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, role, jar);
}

/** A job seeker applies for j1 (川味小馆, e1); returns the application id as the business sees it. */
async function applied(seeker: string, boss = BOSS) {
  await signedIn(seeker);
  expect(await applyForJob("j1", "", PAGE)).toMatchObject({ ok: true });
  await ensureAccount(boss);
  await openEmployerIdentity(boss, "e1");
  await signedIn(boss, "employer");
  const list = await getMyJobApplicants("j1");
  return list!.applicants.find((a) => a.profile.name === "林晓" && !a.interview)!.id;
}

beforeEach(() => {
  setAuthStoreForTests();
  setChatServerStoreForTests(memoryChatStore());
  cookies.clear();
});

describe("约面试 (#103)", () => {
  it("the employer invites at any times; the job seeker sees it, confirms one, and the employer hears back", async () => {
    const id = await applied("interview.seeker@example.com");
    expect(
      await inviteMyApplicant(id, { slots: [LATER, SOON], mode: "in_person", place: "店里", note: "带上简历" }),
    ).toMatchObject({ ok: true, interview: { status: "proposed", slots: [SOON, LATER] } });
    expect((await getMyJobApplicants("j1"))!.applicants.find((a) => a.id === id)?.interview?.status).toBe("proposed");
    expect((await myInterviewTodos()).map((t) => t.title)).toContain("待确认的面试：林晓");

    await signedIn("interview.seeker@example.com");
    const [mine] = (await myApplicationViews())!;
    expect(mine.interview).toMatchObject({ status: "proposed", place: "店里", note: "带上简历" });
    const notices = (await myAlertNotifications())!.items.filter((n) => n.type === "面试");
    expect(notices).toHaveLength(1);
    expect(notices[0].title).toContain("邀请你面试");
    expect(notificationHref(notices[0], { email: "x", signedInAt: "", activeRole: "seeker" })).toBe("/me/saved");
    expect((await myInterviewTodos())[0]).toMatchObject({
      title: expect.stringMatching(/^待确认的面试：/),
      href: "/me/saved",
    });
    // Read once, it stays read.
    await markMyNotificationsRead([notices[0].id]);

    expect(await answerMyInterview("j1", { kind: "confirm", slot: "2020-01-01T00:00:00.000Z" })).toMatchObject({
      ok: false,
    });
    expect(await answerMyInterview("j1", { kind: "confirm", slot: LATER })).toMatchObject({
      ok: true,
      interview: { status: "confirmed", chosenSlot: LATER },
    });
    expect(await answerMyInterview("j1", { kind: "decline" })).toMatchObject({ ok: false });

    await signedIn(BOSS, "employer");
    const replies = (await myAlertNotifications())!.items.filter((n) => n.type === "面试");
    expect(replies).toMatchObject([
      { title: "林晓确认了「前厅服务员」的面试", target: { type: "applicants", jobId: "j1" } },
    ]);
  });

  it("changing the times or cancelling tells the job seeker again; a counter-offer is the job seeker's own words", async () => {
    const id = await applied("interview.counter@example.com");
    await inviteMyApplicant(id, { callFirst: true });
    await signedIn("interview.counter@example.com");
    const first = (await myAlertNotifications())!.items.find((n) => n.type === "面试")!;
    expect(first.detail).toBe("电话联系后再定");
    await markMyNotificationsRead([first.id]);
    expect(await answerMyInterview("j1", { kind: "counter", reply: "" })).toEqual({
      ok: false,
      error: "写一句你方便的时间",
    });
    expect(await answerMyInterview("j1", { kind: "counter", reply: "周四下午都可以" })).toMatchObject({ ok: true });

    await signedIn(BOSS, "employer");
    expect((await myInterviewTodos()).map((t) => t.title)).toContain("林晓回了方便的时间");
    expect(await inviteMyApplicant(id, { slots: ["2020-01-01T00:00:00.000Z"] })).toMatchObject({ ok: false });
    expect(await inviteMyApplicant(id, { slots: [SOON] })).toMatchObject({ ok: true });
    expect(await cancelMyApplicantInterview(id)).toMatchObject({ status: "cancelled" });

    await signedIn("interview.counter@example.com");
    const after = (await myAlertNotifications())!.items.filter((n) => n.type === "面试");
    expect(after.map((n) => n.id)).not.toContain(first.id);
    expect(after[0].title).toContain("的面试取消了");
    expect(await answerMyInterview("j1", { kind: "confirm", slot: SOON })).toMatchObject({ ok: false });
    expect(await myInterviewTodos()).toEqual([]);
  });

  it("only the job's business invites, only its applicant answers, and withdrawing takes the interview away", async () => {
    const id = await applied("interview.other@example.com");
    await signedIn("interview.stranger@example.com");
    expect(await inviteMyApplicant(id, { slots: [SOON] })).toMatchObject({ ok: false });
    await ensureAccount("interview.otherboss@example.com");
    await openEmployerIdentity("interview.otherboss@example.com", "e2");
    await signedIn("interview.otherboss@example.com", "employer");
    expect(await inviteMyApplicant(id, { slots: [SOON] })).toMatchObject({ ok: false });
    expect(await cancelMyApplicantInterview(id)).toBeNull();

    await signedIn(BOSS, "employer");
    expect(await inviteMyApplicant(id, { slots: [SOON] })).toMatchObject({ ok: true });
    await signedIn("interview.stranger@example.com");
    expect(await answerMyInterview("j1", { kind: "confirm", slot: SOON })).toEqual({
      ok: false,
      error: "找不到这个面试邀约",
    });
    await signedIn("interview.other@example.com");
    expect(await withdrawMyApplication("j1")).toBe(true);
    expect(await answerMyInterview("j1", { kind: "confirm", slot: SOON })).toMatchObject({ ok: false });
    await signedIn(BOSS, "employer");
    expect((await getMyJobApplicants("j1"))!.applicants.map((a) => a.id)).not.toContain(id);
  });
});
