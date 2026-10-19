import { beforeEach, describe, expect, it } from "vitest";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import {
  KEEP_DAYS,
  listViewModerators,
  listViews,
  recordViews,
  resetViewCleanupForTests,
} from "@/db/personal-info-views";
import { LIST_LIMIT } from "@/lib/personal-info-views";

const NOW = new Date("2026-10-20T02:00:00Z"); // 15:00 on 20 October in New Zealand
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

beforeEach(async () => {
  const db = await database();
  await db.delete(t.personalInfoViews);
  resetViewCleanupForTests();
});

describe("records of personal information shown to moderators (#336)", () => {
  it("records who, when, which kind and which record, once per record", async () => {
    expect(await recordViews("mod@example.com", "verification", ["vr-1", "vr-2", "vr-1"], NOW)).toBe(2);
    const db = await database();
    const v = t.personalInfoViews;
    const rows = await db
      .select({ at: v.at, day: v.day, moderator: v.moderator, kind: v.kind, subjectId: v.subjectId })
      .from(v)
      .orderBy(v.id);
    expect(rows).toEqual([
      {
        at: "2026-10-20T02:00:00Z",
        day: "2026-10-20",
        moderator: "mod@example.com",
        kind: "verification",
        subjectId: "vr-1",
      },
      {
        at: "2026-10-20T02:00:00Z",
        day: "2026-10-20",
        moderator: "mod@example.com",
        kind: "verification",
        subjectId: "vr-2",
      },
    ]);
    expect(await recordViews("mod@example.com", "verification", [], NOW)).toBe(0);
  });

  it("counts the same record seen again within 30 minutes as the same view, by the same moderator only", async () => {
    await recordViews("mod@example.com", "verification", ["vr-1"], NOW);
    expect(await recordViews("mod@example.com", "verification", ["vr-1", "vr-3"], minutes(29))).toBe(1);
    expect(await recordViews("other.mod@example.com", "verification", ["vr-1"], minutes(29))).toBe(1);
    expect(await recordViews("mod@example.com", "contact", ["vr-1"], minutes(29))).toBe(1);
    expect(await recordViews("mod@example.com", "verification", ["vr-1"], minutes(31))).toBe(1);
  });

  it("lists the last days' records newest first, for everyone or one moderator", async () => {
    await recordViews("a.mod@example.com", "verification", ["vr-old"], new Date("2026-10-12T02:00:00Z"));
    await recordViews("a.mod@example.com", "verification", ["vr-1"], NOW);
    await recordViews("b.mod@example.com", "verification", ["vr-2"], minutes(5));

    const week = await listViews({ days: 7 }, minutes(10));
    expect(week.views.map((v) => v.subjectId)).toEqual(["vr-2", "vr-1"]);
    expect(week.more).toBe(false);
    expect((await listViews({ days: 30 }, minutes(10))).views.map((v) => v.subjectId)).toEqual([
      "vr-2",
      "vr-1",
      "vr-old",
    ]);
    expect(
      (await listViews({ days: 30, moderator: "a.mod@example.com" }, minutes(10))).views.map((v) => v.subjectId),
    ).toEqual(["vr-1", "vr-old"]);
    expect(await listViewModerators()).toEqual(["a.mod@example.com", "b.mod@example.com"]);
  });

  it("returns at most LIST_LIMIT records, and says there are more", async () => {
    const ids = Array.from({ length: LIST_LIMIT + 1 }, (_, i) => `vr-${i}`);
    await recordViews("mod@example.com", "verification", ids, NOW);
    const { views, more } = await listViews({ days: 7 }, NOW);
    expect(views).toHaveLength(LIST_LIMIT);
    expect(more).toBe(true);
  });

  it("deletes records older than a year with the first record of a day", async () => {
    const yearAgo = new Date(NOW.getTime() - KEEP_DAYS * 86_400_000);
    await recordViews("mod@example.com", "verification", ["vr-too-old"], new Date(yearAgo.getTime() - 60_000));
    await recordViews("mod@example.com", "verification", ["vr-kept"], new Date(yearAgo.getTime() + 60_000));
    resetViewCleanupForTests();
    await recordViews("mod@example.com", "verification", ["vr-new"], NOW);
    const db = await database();
    const left = await db.select({ subjectId: t.personalInfoViews.subjectId }).from(t.personalInfoViews);
    expect(left.map((r) => r.subjectId).sort()).toEqual(["vr-kept", "vr-new"]);
  });
});
