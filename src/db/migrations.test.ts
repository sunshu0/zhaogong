import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { getDb, projectRoot, resetDbForTests } from "@/db/client";

/** A copy of drizzle/ that stops after the first `count` migrations, as a database made back then has. */
function migrationsUpTo(count: number): string {
  const dir = mkdtempSync(path.join(tmpdir(), "zhaogong-migrations-"));
  cpSync(path.join(projectRoot(), "drizzle"), dir, { recursive: true });
  const journalFile = path.join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalFile, "utf8"));
  journal.entries = journal.entries.slice(0, count);
  writeFileSync(journalFile, JSON.stringify(journal));
  return dir;
}

describe("versioned migrations", () => {
  const made: string[] = [];
  afterEach(() => {
    resetDbForTests();
    for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("brings a database from the first migration up to date and keeps its jobs", async () => {
    resetDbForTests();
    const first = migrationsUpTo(1);
    made.push(first);
    const db = getDb();
    await migrate(db, { migrationsFolder: first });
    await db.run(sql`insert into employers (id, name, verification, region_id, created_at)
      values ('e1', '川味小馆', 'business_verified', 'akl-mt-eden', '2026-09-01')`);
    await db.run(sql`insert into jobs (id, country, employer_id, title_zh, title_en, industry, employment_type,
      region_id, pay_min_cents, meals_included, accommodation_included, visa_accepted, languages, description_zh,
      description_en, contact, status, posted_at, expires_at, urgent)
      values ('j1', 'NZ', 'e1', '前厅服务员', 'Front-of-house staff', 'hospitality', 'part_time', 'akl-mt-eden',
      2500, 1, 0, '["student"]', '[]', '点餐', 'Orders', '{}', 'active', '2026-10-10', '2026-11-09', 0)`);

    await migrate(db, { migrationsFolder: path.join(projectRoot(), "drizzle") });

    const rows = await db.all<{ employment_type: string; contact_public: number }>(
      sql`select employment_type, contact_public from jobs where id = 'j1'`,
    );
    expect(rows).toEqual([{ employment_type: '["part_time"]', contact_public: 0 }]);
    const tables = await db.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'table' order by name`,
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining(["accounts", "conversations", "exchanges", "messages", "sessions", "sign_in_codes"]),
    );
  });

  it("makes every account that already had a business its team's admin (0013, #87)", async () => {
    resetDbForTests();
    const before = migrationsUpTo(13);
    made.push(before);
    const db = getDb();
    await migrate(db, { migrationsFolder: before });
    await db.run(sql`insert into employers (id, name, verification, region_id, created_at)
      values ('e1', '川味小馆', 'unverified', 'akl-mt-eden', '2026-09-01')`);
    await db.run(sql`insert into accounts (email, created_at, employer_id)
      values ('boss@example.com', '2026-09-01T00:00:00.000Z', 'e1'), ('seeker@example.com', '2026-09-02T00:00:00.000Z', null)`);

    await migrate(db, { migrationsFolder: path.join(projectRoot(), "drizzle") });

    const rows = await db.all<{ email: string; team_role: string | null; team_joined_at: string | null }>(
      sql`select email, team_role, team_joined_at from accounts order by email`,
    );
    expect(rows).toEqual([
      { email: "boss@example.com", team_role: "admin", team_joined_at: "2026-09-01T00:00:00.000Z" },
      { email: "seeker@example.com", team_role: null, team_joined_at: null },
    ]);
    // A second account can now work for the same business.
    await db.run(sql`insert into accounts (email, created_at, employer_id, team_role)
      values ('staff@example.com', '2026-10-01T00:00:00.000Z', 'e1', 'member')`);
  });
});
