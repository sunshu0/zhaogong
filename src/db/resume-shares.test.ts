import { describe, expect, it } from "vitest";
import { closeResumeShare, myResumeShare, saveResumeShare, sharedResume } from "@/db/resume-shares";
import { parseResumeDoc } from "@/components/seeker/resume-doc";
import { ensureAccount } from "@/lib/data";

const t0 = new Date("2026-10-17T01:00:00.000Z");
const doc = (name: string) => parseResumeDoc({ zh: { name }, contact: { phone: "021" } })!;

describe("resume share links (#86)", () => {
  it("makes one link per account, for an account that exists, and keeps the link when shared again", async () => {
    expect(await saveResumeShare("nobody@example.com", doc("无"), t0)).toBe("no_account");
    await ensureAccount("sharer@example.com");
    const first = await saveResumeShare(" Sharer@Example.com ", doc("林晓"), t0);
    if (first === "no_account") throw new Error("account expected");
    expect(first.id).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(await sharedResume(first.id)).toEqual({ resume: doc("林晓"), updatedAt: t0.toISOString() });

    const later = new Date(t0.getTime() + 60_000);
    const again = await saveResumeShare("sharer@example.com", doc("林晓 Lin"), later);
    if (again === "no_account") throw new Error("account expected");
    expect(again.id).toBe(first.id);
    expect(again.createdAt).toBe(t0.toISOString());
    expect((await sharedResume(first.id))?.resume.zh.name).toBe("林晓 Lin");
    expect((await myResumeShare("sharer@example.com"))?.updatedAt).toBe(later.toISOString());
  });

  it("closes the link: it shows nothing, and sharing again makes a new one", async () => {
    await ensureAccount("closer@example.com");
    const open = await saveResumeShare("closer@example.com", doc("陈雨"), t0);
    if (open === "no_account") throw new Error("account expected");
    expect(await closeResumeShare("closer@example.com")).toBe(true);
    expect(await closeResumeShare("closer@example.com")).toBe(false);
    expect(await sharedResume(open.id)).toBeUndefined();
    expect(await myResumeShare("closer@example.com")).toBeUndefined();
    const reopened = await saveResumeShare("closer@example.com", doc("陈雨"), t0);
    if (reopened === "no_account") throw new Error("account expected");
    expect(reopened.id).not.toBe(open.id);
  });

  it("reads nothing for a malformed id", async () => {
    expect(await sharedResume("")).toBeUndefined();
    expect(await sharedResume("../../etc")).toBeUndefined();
  });
});
