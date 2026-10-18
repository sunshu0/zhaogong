import { describe, expect, it } from "vitest";
import { myClosingNotifications } from "@/app/[lang]/employer/closing-notifications";
import { openEmployerIdentity, updateJob } from "@/lib/data";

const DAY = 86_400_000;

describe("closing notifications (#69)", () => {
  it("tells the business's account about its jobs closing within 3 days, linking to 职位管理", async () => {
    const email = "closing.e6@example.com";
    expect((await openEmployerIdentity(email, "e6")).ok).toBe(true);
    const now = Date.now();
    await updateJob("j10", { status: "active", expiresAt: new Date(now + 2 * DAY + 60_000).toISOString() });
    const items = await myClosingNotifications(email, now);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: "招聘",
      title: expect.stringMatching(/^「.+」3 天后截止$/),
      unread: true,
      target: { type: "closing_jobs" },
    });
    expect(items[0].id).toMatch(/^closing:j10:/);
  });

  it("has nothing for an account without a business", async () => {
    expect(await myClosingNotifications("nobody.here@example.com", Date.now())).toEqual([]);
  });
});
