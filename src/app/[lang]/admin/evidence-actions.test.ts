import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { ensureAccount, submitReport } from "@/lib/data";
import { grantModerator } from "@/db/moderators";
import { listViews } from "@/db/personal-info-views";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { getReportEvidence } = await import("@/app/[lang]/admin/evidence-actions");
const { getModerationQueue } = await import("@/app/[lang]/admin/actions");

const MODERATOR = "evidence.moderator@example.com";

async function signIn(email: string) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}

/** A report on j1 with two messages (sent out of order) and one screenshot. */
async function reportWithEvidence() {
  return submitReport("j1", "charges_fee", "押金", {
    reporterEmail: "reporter@example.com",
    messages: [
      { messageId: 12, from: "employer", byName: "王经理", text: "入职前先交 200 元押金", sentAt: "2026-10-20T01:02:00Z" },
      { messageId: 11, from: "seeker", byName: null, text: "你好，还招人吗？", sentAt: "2026-10-20T01:01:00Z" },
    ],
    images: [{ key: "evidence-test-key", type: "image/png", bytes: 1234 }],
  });
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

describe("举报证据 in /admin (#353)", () => {
  it("is for moderators only, and records nothing for anyone else", async () => {
    const report = await reportWithEvidence();
    cookies.clear();
    expect(await getReportEvidence(report.id)).toMatchObject({ refused: "signed_out" });
    await signIn("not.a.moderator@example.com");
    expect(await getReportEvidence(report.id)).toMatchObject({ refused: "not_moderator" });
    expect((await listViews({ days: 7 })).views.filter((v) => v.subjectId === report.id)).toEqual([]);
  });

  it("lists only counts in the queue; the evidence comes when opened, recorded first", async () => {
    const report = await reportWithEvidence();
    await signIn(MODERATOR);
    const queue = await getModerationQueue();
    if ("refused" in queue) throw new Error(queue.error_zh);
    const listed = queue.reported.flatMap((item) => item.reports).find((r) => r.id === report.id);
    expect(listed?.evidence).toEqual({ messages: 2, images: 1 });
    expect(JSON.stringify(queue)).not.toContain("入职前先交 200 元押金");
    expect((await listViews({ days: 7 })).views.filter((v) => v.subjectId === report.id)).toEqual([]);

    const opened = await getReportEvidence(report.id);
    if ("refused" in opened) throw new Error(opened.error_zh);
    expect(opened.evidence.map((e) => (e.kind === "message" ? e.text : e.kind))).toEqual([
      "你好，还招人吗？",
      "入职前先交 200 元押金",
      "image",
    ]);
    expect(opened.evidence[1]).toMatchObject({ from: "employer", byName: "王经理" });
    expect(JSON.stringify(opened)).not.toContain("reporter@example.com");
    expect((await listViews({ days: 7 })).views.filter((v) => v.subjectId === report.id)).toEqual([
      { at: expect.any(String), moderator: MODERATOR, kind: "chat", subjectId: report.id },
    ]);
  });

  it("gives nothing for a report that is not there, and lists no evidence for a report without any", async () => {
    await signIn(MODERATOR);
    expect(await getReportEvidence("r-nope")).toEqual({ evidence: [] });
    expect(await getReportEvidence(42)).toEqual({ evidence: [] });
    const plain = await submitReport("j1", "charges_fee", "没有附证据");
    const queue = await getModerationQueue();
    if ("refused" in queue) throw new Error(queue.error_zh);
    const listed = queue.reported.flatMap((item) => item.reports).find((r) => r.id === plain.id);
    expect(listed).toBeDefined();
    expect(listed).not.toHaveProperty("evidence");
  });
});
