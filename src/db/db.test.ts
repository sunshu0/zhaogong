import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getDb, resetDbForTests } from "@/db/client";
import { migrateDb } from "@/db/migrate";
import { accounts, employers, jobs } from "@/db/schema";

describe("database", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = "file::memory:";
    resetDbForTests();
    await migrateDb();
  });
  afterEach(() => resetDbForTests());

  it("migrates and round-trips JSON, boolean and cents columns", async () => {
    const db = getDb();
    await db.insert(employers).values({
      id: "e1",
      name: "川味小馆",
      verification: "business_verified",
      regionId: "akl-mt-eden",
      createdAt: "2026-09-01",
    });
    await db.insert(jobs).values({
      id: "j1",
      country: "NZ",
      employerId: "e1",
      titleZh: "前厅服务员",
      titleEn: "Front-of-house staff",
      industry: "hospitality",
      employmentType: ["part_time"],
      regionId: "akl-mt-eden",
      payMin: 2500,
      payMax: 2700,
      mealsIncluded: true,
      accommodationIncluded: false,
      visaAccepted: ["student"],
      languages: ["mandarin"],
      descriptionZh: "点餐",
      descriptionEn: "Orders",
      contact: { phone: "021 555 0101" },
      status: "active",
      postedAt: "2026-10-10T00:00:00.000Z",
      expiresAt: "2026-11-09T00:00:00.000Z",
      urgent: true,
    });
    const [row] = await db.select().from(jobs).where(eq(jobs.id, "j1"));
    expect(row).toMatchObject({
      employmentType: ["part_time"],
      contactPublic: false,
      payMin: 2500,
      mealsIncluded: true,
      visaAccepted: ["student"],
      contact: { phone: "021 555 0101" },
    });
  });

  it("lets a business have a team of accounts (#87), each account working for one business", async () => {
    const db = getDb();
    await db
      .insert(employers)
      .values({ id: "e1", name: "店", verification: "unverified", regionId: "akl-cbd", createdAt: "2026-10-13" });
    await db
      .insert(accounts)
      .values({ email: "a@example.com", createdAt: "2026-10-13", employerId: "e1", teamRole: "admin" });
    await db
      .insert(accounts)
      .values({ email: "b@example.com", createdAt: "2026-10-13", employerId: "e1", teamRole: "member" });
    const team = await db.select().from(accounts).where(eq(accounts.employerId, "e1"));
    expect(team.map((a) => a.teamRole).sort()).toEqual(["admin", "member"]);
    // Not a business that does not exist.
    await expect(
      db.insert(accounts).values({ email: "c@example.com", createdAt: "2026-10-13", employerId: "e404" }),
    ).rejects.toThrow();
  });
});
