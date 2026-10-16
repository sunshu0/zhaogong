import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { ensureAccount, listModerationLog } from "@/lib/data";
import { grantModerator } from "@/db/moderators";
import { getExternalJob, listCompanyBlocks, listExternalJobs } from "@/db/external-jobs";
import { importExternalJobs } from "@/lib/external-jobs/import";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const {
  approveExternalJob,
  getExternalReview,
  hideExternalJob,
  recordTakedownRequest,
  resumeExternalCompany,
  stopExternalCompany,
} = await import("@/app/admin/external-actions");

const MODERATOR = "external.moderator@example.com";

async function signIn(email: string) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}

beforeAll(async () => {
  vi.stubEnv("ADMIN_ENABLED", "1");
  setAuthStoreForTests();
  await ensureAccount(MODERATOR);
  await grantModerator(MODERATOR, null);
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const queue = async () => {
  const q = await getExternalReview();
  if ("refused" in q) throw new Error(q.error_zh);
  return q;
};

describe("外部职位 in /admin (#112)", () => {
  it("is for moderators only", async () => {
    await signIn("not.a.moderator@example.com");
    expect(await getExternalReview()).toMatchObject({ refused: "not_moderator" });
    expect(await approveExternalJob("demo-tui:6f1d3a0e-0002", false)).toMatchObject({ ok: false });
    expect(await stopExternalCompany("demo-tui", "试试")).toMatchObject({ ok: false });
    cookies.clear();
    expect(await getExternalReview()).toMatchObject({ refused: "signed_out" });
  });

  it("lists the jobs waiting (flagged first), the approved ones, and every company with its terms", async () => {
    await signIn(MODERATOR);
    const q = await queue();
    expect(q.pending.map((j) => j.id)).toEqual(["demo-kowhai:4002", "demo-tui:6f1d3a0e-0002"]);
    expect(q.approved.map((j) => [j.id, j.shown])).toEqual(expect.arrayContaining([["demo-tui:6f1d3a0e-0001", true]]));
    const rocketLab = q.companies.find((c) => c.id === "rocketlab");
    expect(rocketLab).toMatchObject({ onList: true, terms: null, imported: false, pending: 0 });
    expect(q.companies.find((c) => c.id === "demo-kowhai")).toMatchObject({
      name: "Kōwhai Robotics",
      onList: false,
      pending: 1,
      shown: 3,
    });
  });

  it("shows a job only after a moderator approves it; a flagged one only once the original was checked", async () => {
    await signIn(MODERATOR);
    expect(await approveExternalJob("demo-tui:6f1d3a0e-0002", false)).toMatchObject({
      ok: true,
      text: "通过外部职位「Software Engineering Intern」（Tūī Software）",
    });
    expect((await listExternalJobs({ shownAt: new Date() })).map((j) => j.id)).toContain("demo-tui:6f1d3a0e-0002");

    const flagged = await approveExternalJob("demo-kowhai:4002", false);
    expect(flagged).toMatchObject({ ok: false, error_zh: expect.stringContaining("U.S. person") });
    expect((await getExternalJob("demo-kowhai:4002"))?.review).toBe("pending");

    expect(await hideExternalJob("demo-kowhai:4002", "other", " ")).toMatchObject({ ok: false });
    expect(await hideExternalJob("demo-kowhai:4002", "requirement", "")).toMatchObject({
      ok: true,
      text: "不显示外部职位「Senior Electronics Engineer」（Kōwhai Robotics） · 有按国籍、种族招人的要求",
    });
    expect((await getExternalJob("demo-kowhai:4002"))?.review).toBe("hidden");
    const log = await listModerationLog();
    expect(log[0]).toMatchObject({ action: "external_hide", moderator: MODERATOR, jobId: "demo-kowhai:4002" });
  });

  it("stops a company: all its jobs come down at once, and the importer no longer reads it", async () => {
    await signIn(MODERATOR);
    expect(await stopExternalCompany("demo-kowhai", "")).toMatchObject({ ok: false, error_zh: "请写明原因。" });
    expect(await stopExternalCompany("demo-kowhai", "试点结束")).toMatchObject({
      ok: true,
      text: "停用外部公司「Kōwhai Robotics」，下架 4 个职位 · 试点结束",
    });
    expect((await listExternalJobs({ companyId: "demo-kowhai" })).every((j) => j.removedAt != null)).toBe(true);
    expect(await stopExternalCompany("demo-kowhai", "再来一次")).toMatchObject({ ok: false });

    const asked: string[] = [];
    const reports = await importExternalJobs({
      companies: [
        {
          id: "demo-kowhai",
          name: "Kōwhai Robotics",
          source: "greenhouse",
          board: "kowhai",
          careersUrl: "https://example.com",
          terms: { checkedBy: "测试", checkedOn: "2026-10-17", allowsDisplay: true, note: "test" },
        },
      ],
      getJson: async (url) => {
        asked.push(url);
        return { jobs: [] };
      },
    });
    expect(reports).toEqual([{ company: "demo-kowhai", status: "stopped", kind: "stopped" }]);
    expect(asked).toEqual([]);

    expect(await resumeExternalCompany("demo-kowhai", "")).toMatchObject({ ok: false });
    expect(await resumeExternalCompany("demo-kowhai", "误操作")).toMatchObject({
      ok: true,
      text: "恢复导入外部公司「Kōwhai Robotics」 · 误操作",
    });
    expect(await listCompanyBlocks()).toEqual([]);
    // Back from a stop, every job needs a moderator again before it shows.
    expect((await listExternalJobs({ companyId: "demo-kowhai" })).every((j) => j.review === "pending")).toBe(true);
  });

  it("records a company's takedown request with who asked, and takes everything down today", async () => {
    await signIn(MODERATOR);
    expect(await recordTakedownRequest("demo-tui", "", "请删除")).toMatchObject({ ok: false });
    expect(await recordTakedownRequest("nobody", "hr@example.com", "请删除")).toMatchObject({
      ok: false,
      error_zh: "找不到这家公司。",
    });
    expect(
      await recordTakedownRequest("demo-tui", "careers@tui.example.com", "10月17日来信，要求不再转载职位"),
    ).toMatchObject({
      ok: true,
      text: "公司要求删除「Tūī Software」，下架 2 个职位 · careers@tui.example.com：10月17日来信，要求不再转载职位",
    });
    expect(await listExternalJobs({ shownAt: new Date(), companyId: "demo-tui" })).toEqual([]);
    expect((await listCompanyBlocks())[0]).toMatchObject({
      companyId: "demo-tui",
      kind: "takedown",
      requester: "careers@tui.example.com",
    });
    expect((await queue()).companies.find((c) => c.id === "demo-tui")).toMatchObject({
      block: { kind: "takedown" },
      shown: 0,
    });
  });
});
