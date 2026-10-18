import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { memoryChatStore, setChatServerStoreForTests } from "@/lib/chat-server/store";
import { createJob, ensureAccount } from "@/lib/data";
import { grantModerator } from "@/db/moderators";
import { matchJobAlerts } from "@/db/job-alerts";
import { getExternalJob } from "@/db/external-jobs";
import { MOCK_JOBS } from "@/mock/data";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { changeMyJobAlert, myAlertNotifications, myJobAlerts, saveMyJobAlert } =
  await import("@/app/[lang]/me/alerts/actions");
const { approveExternalJob, hideExternalJob } = await import("@/app/[lang]/admin/external-actions");
const { markMyNotificationsRead } = await import("@/app/[lang]/messages/actions");

const MODERATOR = "alerts.moderator@example.com";
const INTERN = "demo-tui:6f1d3a0e-0002"; // Software Engineering Intern, Auckland, waiting for review
const SENIOR = "demo-kowhai:4002"; // Senior Electronics Engineer, kind not stated (专业职位), waiting for review

async function signIn(email: string) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}

async function approve(id: string) {
  await signIn(MODERATOR);
  expect(await approveExternalJob(id, true)).toMatchObject({ ok: true });
}

beforeAll(async () => {
  vi.stubEnv("ADMIN_ENABLED", "1");
  setAuthStoreForTests();
  setChatServerStoreForTests(memoryChatStore());
  await ensureAccount(MODERATOR);
  await grantModerator(MODERATOR, null);
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe("职位提醒 on 实习 and 专业职位 (#131)", () => {
  it("saves a section's filters as an alert, beside the job list's, with the section's words and link", async () => {
    await signIn("x.saver@example.com");
    const saved = await saveMyJobAlert("city=auckland&field=software&kind=full_time&junk=1", "internship");
    expect(saved).toMatchObject({
      status: "created",
      alert: {
        name: "实习：软件、奥克兰",
        query: "field=software&city=auckland",
        section: "internship",
        href: "/internships?field=software&city=auckland",
        conditions: ["软件", "奥克兰"],
        paused: false,
      },
    });
    expect((await saveMyJobAlert("field=software&city=auckland", "internship"))?.status).toBe("exists");
    // The same query on the other section, or on the job list, is another alert.
    expect((await saveMyJobAlert("field=software&city=auckland", "professional"))?.status).toBe("created");
    expect(await saveMyJobAlert("", undefined)).toMatchObject({ alert: { section: null, href: "/jobs" } });
    // An unknown section is the job list.
    expect((await saveMyJobAlert("", "nowhere" as never))?.status).toBe("exists");
    expect((await myJobAlerts())!.map((a) => a.section)).toEqual(["internship", "professional", null]);
  });

  it("counts both kinds toward the 5 an account may have", async () => {
    await signIn("x.full@example.com");
    for (const q of ["q=一", "q=二", "q=三", "q=四"]) await saveMyJobAlert(q);
    expect((await saveMyJobAlert("", "professional"))?.status).toBe("created");
    expect(await saveMyJobAlert("field=software", "professional")).toEqual({ status: "limit" });
  });

  it("tells running alerts of the job's section that it matches when a moderator approves it, once", async () => {
    await signIn("x.soft@example.com");
    await saveMyJobAlert("field=software", "internship");
    await signIn("x.elec@example.com");
    await saveMyJobAlert("field=electrical", "internship");
    await signIn("x.pro@example.com");
    await saveMyJobAlert("", "professional");
    await signIn("x.paused@example.com");
    const paused = await saveMyJobAlert("", "internship");
    if (paused?.status !== "created") throw new Error("not saved");
    await changeMyJobAlert(paused.alert.id, { paused: true });

    await approve(INTERN);

    await signIn("x.soft@example.com");
    const intern = (await getExternalJob(INTERN))!;
    expect((await myAlertNotifications())?.items).toEqual([
      {
        id: `alert:external:${INTERN}`,
        type: "提醒",
        title: "有外部职位符合提醒「实习：软件」",
        detail: `Tūī Software：${intern.title}（来自公司官网）`,
        time: "今天",
        unread: true,
        target: { type: "external_job", id: INTERN },
      },
    ]);
    expect((await markMyNotificationsRead([`alert:external:${INTERN}`, "alert:external:nope"]))?.ids).toEqual([
      `alert:external:${INTERN}`,
    ]);
    for (const other of ["x.elec@example.com", "x.pro@example.com", "x.paused@example.com"]) {
      await signIn(other);
      expect((await myAlertNotifications())?.items).toEqual([]);
    }

    // Taken down and approved again: no second notification; the first one says it is gone while it is.
    await signIn(MODERATOR);
    expect(await hideExternalJob(INTERN, "other", "测试")).toMatchObject({ ok: true });
    await signIn("x.soft@example.com");
    expect((await myAlertNotifications())?.items[0].detail).toBe(`${intern.title}已经下架`);
    await approve(INTERN);
    await signIn("x.soft@example.com");
    expect((await myAlertNotifications())?.items).toHaveLength(1);
  });

  it("finds 专业职位 for alerts on that section, the kind not stated included", async () => {
    await approve(SENIOR);
    await signIn("x.pro@example.com");
    expect((await myAlertNotifications())?.items.map((n) => n.id)).toEqual([`alert:external:${SENIOR}`]);
    await signIn("x.soft@example.com");
    expect((await myAlertNotifications())?.items.map((n) => n.id)).toEqual([`alert:external:${INTERN}`]);
  });

  it("leaves the job list's jobs to the job list's alerts", async () => {
    await signIn("x.all@example.com");
    await saveMyJobAlert("", "internship");
    await saveMyJobAlert("", "professional");
    const job = await createJob({
      ...MOCK_JOBS[0],
      postedAt: new Date().toISOString(),
      expiresAt: "2099-01-01T00:00:00.000Z",
    });
    expect(await matchJobAlerts(job)).not.toContain("x.all@example.com");
  });
});
