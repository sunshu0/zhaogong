import { describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { ensureAccount } from "@/lib/data";
import { exportAccountData } from "@/db/account-data";
import { NO_PHRASES, PHRASE_MAX, PHRASES_MAX } from "@/lib/chat-phrases";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { myChatPhrases, saveMyChatPhrases } = await import("@/app/[lang]/messages/phrases-actions");

async function signedIn(email: string) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}
const kept = async () => (await myChatPhrases())?.phrases;

describe("常用语 and 开场白 on the server (#372, #373, ADR 0035)", () => {
  it("are the defaults (all null) until changed, and nothing for someone signed out", async () => {
    cookies.clear();
    expect(await myChatPhrases()).toBeNull();
    expect(await saveMyChatPhrases({ role: "seeker", phrases: ["你好"] })).toBeNull();
    await signedIn("phrases.new@example.com");
    expect(await myChatPhrases()).toEqual({ email: "phrases.new@example.com", phrases: NO_PHRASES });
  });

  it("keep each identity's list apart, and the opener; what is left out stays as it was", async () => {
    await signedIn("phrases.both@example.com");
    const saved = await saveMyChatPhrases({ role: "seeker", phrases: [" 还招吗？ ", "", "谢谢"] });
    expect(saved).toMatchObject({ ok: true, phrases: { seeker: ["还招吗？", "谢谢"], employer: null, opener: null } });
    await saveMyChatPhrases({ role: "employer", phrases: ["已经招到人了"], opener: { template: 3 } });
    expect(await kept()).toEqual({ seeker: ["还招吗？", "谢谢"], employer: ["已经招到人了"], opener: { template: 3 } });
    await saveMyChatPhrases({ role: "seeker", opener: { text: "您好，我想应聘「{职位}」" } });
    expect(await kept()).toEqual({
      seeker: ["还招吗？", "谢谢"],
      employer: ["已经招到人了"],
      opener: { text: "您好，我想应聘「{职位}」" },
    });
    // The account's data comes with them.
    expect((await exportAccountData("phrases.both@example.com"))?.chatPhrases).toEqual(await kept());
    // 恢复默认: null again.
    await saveMyChatPhrases({ role: "seeker", phrases: null, opener: null });
    expect(await kept()).toEqual({ seeker: null, employer: ["已经招到人了"], opener: null });
  });

  it("refuse contact details, too many or too long ones, and save nothing then", async () => {
    await signedIn("phrases.refused@example.com");
    await saveMyChatPhrases({ role: "seeker", phrases: ["原来的"] });
    expect(
      await saveMyChatPhrases({ role: "seeker", phrases: ["你好", "加我微信 zhaogong88 聊"], opener: { template: 2 } }),
    ).toEqual({ ok: false, why: { problem: "contact", index: 1, found: ["zhaogong88"] } });
    expect(await saveMyChatPhrases({ role: "seeker", phrases: ["电话 021 123 4567"] })).toMatchObject({
      ok: false,
      why: { problem: "contact", index: 0 },
    });
    expect(await saveMyChatPhrases({ role: "seeker", opener: { text: "发邮件到 me@example.com" } })).toEqual({
      ok: false,
      why: { problem: "contact", found: ["me@example.com"] },
    });
    expect(
      await saveMyChatPhrases({ role: "seeker", phrases: Array.from({ length: PHRASES_MAX + 1 }, (_, i) => `${i}`) }),
    ).toEqual({ ok: false, why: { problem: "too_many" } });
    expect(await saveMyChatPhrases({ role: "seeker", phrases: ["字".repeat(PHRASE_MAX + 1)] })).toEqual({
      ok: false,
      why: { problem: "too_long", index: 0 },
    });
    expect(await kept()).toEqual({ seeker: ["原来的"], employer: null, opener: null });
  });

  it("take nothing that is not a save", async () => {
    await signedIn("phrases.odd@example.com");
    for (const odd of [null, "seeker", { role: "boss", phrases: [] }, { role: "seeker", phrases: "你好" }])
      expect(await saveMyChatPhrases(odd)).toBeNull();
    expect(await saveMyChatPhrases({ role: "seeker", opener: { template: 7 } })).toBeNull();
    expect(await kept()).toEqual(NO_PHRASES);
  });
});
