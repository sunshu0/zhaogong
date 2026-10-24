import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { addSharedMessage, openSharedConversation } from "@/db/conversations";
import { employerActivities, markEmployerActive } from "@/db/employer-activity";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { createEmployer, createJob, ensureAccount } from "@/lib/data";
import { MOCK_JOBS } from "@/mock/data";
import type { Job } from "@/lib/types";

// 2026-10-24 18:00 in Auckland.
const now = new Date("2026-10-24T05:00:00.000Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

async function shopWithJob(name: string) {
  const shop = await createEmployer({ name, regionId: "akl-cbd" });
  const job: Partial<Job> = { ...MOCK_JOBS[0], employerId: shop.id, status: "active" };
  delete job.id;
  return { shop, job: await createJob(job as Omit<Job, "id">) };
}

/** A job seeker writes `askedMinutesAgo`; the team answers `waitMinutes` later, or never. */
async function chat(shopId: string, jobId: string, n: number, askedMinutesAgo: number, waitMinutes: number | null) {
  const email = `activity.${shopId}.${n}@example.com`;
  await ensureAccount(email);
  const row = await openSharedConversation({
    seekerEmail: email,
    employerId: shopId,
    jobId,
    startedBy: "seeker",
    now: ago(askedMinutesAgo),
  });
  await addSharedMessage(row.id, "seeker", "还招吗？", undefined, ago(askedMinutesAgo));
  if (waitMinutes != null)
    await addSharedMessage(row.id, "employer", "还招", "王经理", ago(askedMinutesAgo - waitMinutes));
  return row;
}

describe("老板活跃度 (#381)", () => {
  it("is read for a whole list in one go: today online, fast replies, and nothing for the rest", async () => {
    const fast = await shopWithJob("快回茶楼");
    const slow = await shopWithJob("慢回茶楼");
    const few = await shopWithJob("少聊茶楼");
    for (let i = 0; i < 5; i++) await chat(fast.shop.id, fast.job.id, i, 300 + i, 15);
    // Two answered after a day and three never: slow, so nothing.
    for (let i = 0; i < 5; i++) await chat(slow.shop.id, slow.job.id, i, 3000 + i, i < 2 ? 26 * 60 : null);
    for (let i = 0; i < 4; i++) await chat(few.shop.id, few.job.id, i, 300 + i, 5);
    await markEmployerActive(fast.shop.id, ago(60));
    await markEmployerActive(slow.shop.id, new Date("2026-10-23T10:30:00.000Z")); // 23:30 yesterday in Auckland

    const found = await employerActivities(
      [fast.shop.id, slow.shop.id, few.shop.id, fast.shop.id, "nobody"],
      now.getTime(),
    );
    expect(found.get(fast.shop.id)).toEqual({ onlineToday: true, replies: "hour" });
    expect(found.get(slow.shop.id)).toEqual({});
    expect(found.get(few.shop.id)).toEqual({});
    expect(found.get("nobody")).toEqual({});
    expect(await employerActivities([], now.getTime())).toEqual(new Map());
  });

  it("counts only conversations the job seeker started, answered by anyone in the team", async () => {
    const { shop, job } = await shopWithJob("先开口茶楼");
    for (let i = 0; i < 4; i++) await chat(shop.id, job.id, i, 600 + i, 120);
    // The business wrote first here: the job seeker's answer is not a question to time.
    await ensureAccount("activity.first.employer@example.com");
    const row = await openSharedConversation({
      seekerEmail: "activity.first.employer@example.com",
      employerId: shop.id,
      jobId: job.id,
      startedBy: "employer",
      now: ago(700),
    });
    await addSharedMessage(row.id, "employer", "看了你的主页", "王经理", ago(700));
    await addSharedMessage(row.id, "seeker", "你好", undefined, ago(690));
    expect((await employerActivities([shop.id], now.getTime())).get(shop.id)).toEqual({});
    await chat(shop.id, job.id, 9, 650, 30);
    expect((await employerActivities([shop.id], now.getTime())).get(shop.id)).toEqual({ replies: "day" });
  });

  it("writes the last use at most every 10 minutes", async () => {
    const { shop } = await shopWithJob("常来茶楼");
    await markEmployerActive(shop.id, ago(30));
    await markEmployerActive(shop.id, ago(25)); // within 10 minutes: not written
    const db = await database();
    const read = async () =>
      (await db.select().from(t.employerActivity).where(eq(t.employerActivity.employerId, shop.id)))[0]?.lastActiveAt;
    expect(await read()).toBe(ago(30).toISOString());
    await markEmployerActive(shop.id, ago(15));
    expect(await read()).toBe(ago(15).toISOString());
  });
});
