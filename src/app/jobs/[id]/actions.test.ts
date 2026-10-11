import { afterEach, describe, expect, it, vi } from "vitest";
import { reportJob, revealContact } from "@/app/jobs/[id]/actions";
import { listContactViews, listReports } from "@/lib/data";

afterEach(() => {
  vi.useRealTimers();
});

describe("revealContact", () => {
  it("returns the contact details and records who saw them", async () => {
    const contact = await revealContact("j1", " Viewer.One@Example.com ");
    expect(contact).toEqual({ phone: "021 555 0101", wechat: "demo_chuanwei", email: undefined });
    const views = await listContactViews("j1");
    expect(views.filter((v) => v.viewerEmail === "viewer.one@example.com")).toHaveLength(1);
  });

  it("records the same person on the same job once per 30 minutes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T01:00:00Z"));
    const mine = async () => (await listContactViews("j3")).filter((v) => v.viewerEmail === "viewer.two@example.com");

    await revealContact("j3", "viewer.two@example.com");
    await revealContact("j3", "viewer.two@example.com"); // page opened again, or React's dev double effect
    expect(await mine()).toHaveLength(1);

    vi.setSystemTime(new Date("2026-10-12T01:31:00Z"));
    await revealContact("j3", "viewer.two@example.com");
    expect(await mine()).toHaveLength(2);
  });

  it("returns nothing and records nothing without a valid email or a public job", async () => {
    const before = (await listContactViews("j2")).length;
    expect(await revealContact("j2", "not-an-email")).toBeNull();
    expect(await revealContact("nope", "viewer.three@example.com")).toBeNull();
    expect((await listContactViews("j2")).length).toBe(before);
  });
});

describe("reportJob", () => {
  it("stores the report on the server, where the moderation queue reads it", async () => {
    const result = await reportJob("j7", "charges_fee", "  要求先交押金  ");
    expect(result.ok).toBe(true);
    const stored = (await listReports()).find((r) => result.ok && r.id === result.reportId);
    expect(stored).toMatchObject({ jobId: "j7", reason: "charges_fee", note: "要求先交押金", status: "open" });
  });

  it("rejects bad input and unknown jobs without storing anything", async () => {
    const before = (await listReports()).length;
    expect(await reportJob("j7", "spam")).toEqual({ ok: false, error: "请选择举报原因" });
    expect((await reportJob("nope", "fake_job")).ok).toBe(false);
    expect((await listReports()).length).toBe(before);
  });
});
