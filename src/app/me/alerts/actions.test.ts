import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { memoryChatStore, setChatServerStoreForTests } from "@/lib/chat-server/store";
import { createJob, ensureAccount, openEmployerIdentity, updateJob } from "@/lib/data";
import { matchJobAlerts } from "@/db/job-alerts";
import { MOCK_JOBS } from "@/mock/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { changeMyJobAlert, deleteMyJobAlert, myAlertNotifications, myJobAlerts, saveMyJobAlert } =
  await import("@/app/me/alerts/actions");
const { markMyNotificationsRead } = await import("@/app/messages/actions");

async function signedIn(email: string, role: "seeker" | "employer" = "seeker") {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, role, jar);
}

beforeEach(() => {
  setAuthStoreForTests();
  setChatServerStoreForTests(memoryChatStore());
  cookies.clear();
});

describe("职位提醒 on the server (#53)", () => {
  it("is nothing for a signed-out browser", async () => {
    expect(await myJobAlerts()).toBeNull();
    expect(await saveMyJobAlert("industry=hospitality")).toBeNull();
    expect(await changeMyJobAlert("x", { paused: true })).toBeNull();
    expect(await deleteMyJobAlert("x")).toBeNull();
    expect(await myAlertNotifications()).toBeNull();
  });

  it("saves the job list's filters for the account in the cookie, named after them", async () => {
    await signedIn("alert.saver@example.com");
    const saved = await saveMyJobAlert("q=洗碗&industry=hospitality&junk=1");
    expect(saved).toEqual({
      status: "created",
      alert: {
        id: expect.any(String),
        name: "餐饮、洗碗",
        query: "industry=hospitality&q=%E6%B4%97%E7%A2%97",
        conditions: ["餐饮", "“洗碗”"],
        paused: false,
      },
    });
    expect((await saveMyJobAlert("industry=hospitality&q=洗碗"))?.status).toBe("exists");
    for (const q of ["q=a", "q=b", "q=c", "q=d"]) await saveMyJobAlert(q);
    expect(await saveMyJobAlert("q=e")).toEqual({ status: "limit" });

    await signedIn("alert.stranger@example.com");
    expect(await myJobAlerts()).toEqual([]);
  });

  it("renames, pauses and deletes; a blank name keeps the old one", async () => {
    await signedIn("alert.editor@example.com");
    const saved = await saveMyJobAlert("meals=1");
    if (saved?.status !== "created") throw new Error("not created");
    const { id } = saved.alert;
    expect(await changeMyJobAlert(id, { name: "  包餐的工作  " })).toMatchObject([{ id, name: "包餐的工作" }]);
    expect(await changeMyJobAlert(id, { name: "   ", paused: true })).toMatchObject([
      { id, name: "包餐的工作", paused: true },
    ]);
    expect(await changeMyJobAlert(id, { paused: false })).toMatchObject([{ paused: false }]);

    await signedIn("alert.intruder@example.com");
    expect(await deleteMyJobAlert(id)).toEqual([]);
    await signedIn("alert.editor@example.com");
    expect(await myJobAlerts()).toHaveLength(1);
    expect(await deleteMyJobAlert(id)).toEqual([]);
  });

  it("shows what the alerts found as the job seeker's notifications, which can be marked read", async () => {
    await signedIn("alert.reader@example.com");
    await saveMyJobAlert("q=通知测试");
    const job = await createJob({
      ...MOCK_JOBS[0],
      titleZh: "通知测试服务员",
      postedAt: new Date().toISOString(),
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    expect(await matchJobAlerts(job)).toContain("alert.reader@example.com");

    const answer = await myAlertNotifications();
    expect(answer?.items).toEqual([
      {
        id: `alert:${job.id}`,
        type: "提醒",
        title: "有新职位符合提醒「通知测试」",
        detail: "川味小馆正在招聘通知测试服务员",
        time: "今天",
        unread: true,
        target: { type: "job", id: job.id },
      },
    ]);
    expect((await markMyNotificationsRead([`alert:${job.id}`, "alert:j-not-mine"]))?.ids).toEqual([`alert:${job.id}`]);

    await updateJob(job.id, { status: "removed" });
    expect((await myAlertNotifications())?.items[0].detail).toBe("通知测试服务员已经停止招聘");
  });

  it("has none for the employer identity", async () => {
    await openEmployerIdentity("alert.boss@example.com", "e2");
    await signedIn("alert.boss@example.com", "employer");
    expect((await myAlertNotifications())?.items).toEqual([]);
  });
});
