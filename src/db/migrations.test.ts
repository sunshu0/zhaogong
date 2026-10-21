import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { migrateLocalDb as migrate } from "@/db/migrate";
import { getDb, projectRoot, resetDbForTests } from "@/db/client";
import { demoShowcase } from "@/db/demo-showcase";
import { suggestJobRoles } from "@/lib/job-roles";
import { MOCK_JOBS } from "@/mock/data";

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

  it("0014 files the jobs it finds under the categories their titles name, as suggestJobRoles does (#96)", async () => {
    resetDbForTests();
    const before = migrationsUpTo(13); // up to 0013_team
    made.push(before);
    const db = getDb();
    await migrate(db, { migrationsFolder: before });
    await db.run(sql`insert into employers (id, name, verification, region_id, created_at)
      values ('e1', '川味小馆', 'business_verified', 'akl-mt-eden', '2026-09-01')`);
    const titles = [
      ...[...MOCK_JOBS, ...demoShowcase(Date.now()).jobs].map((job) => [job.titleZh, job.titleEn, job.industry]),
      ["前台", "Receptionist", "office"],
      ["店长兼收银", "Manager", "retail"],
      ["兼职", "Part time", "hospitality"],
      ["司机", "Driver", "other"],
    ];
    for (const [i, [titleZh, titleEn, industry]] of titles.entries())
      await db.run(sql`insert into jobs (id, country, employer_id, title_zh, title_en, industry, employment_type,
        region_id, pay_min_cents, meals_included, accommodation_included, visa_accepted, languages, description_zh,
        description_en, contact, status, posted_at, expires_at, urgent)
        values (${`t${i}`}, 'NZ', 'e1', ${titleZh}, ${titleEn}, ${industry}, '["part_time"]', 'akl-mt-eden',
        2500, 0, 0, '[]', '[]', '', '', '{}', 'active', '2026-10-10', '2026-11-09', 0)`);

    await migrate(db, { migrationsFolder: path.join(projectRoot(), "drizzle") });

    const rows = await db.all<{ id: string; title_zh: string; title_en: string; industry: string; roles: string }>(
      sql`select id, title_zh, title_en, industry, roles from jobs order by rowid`,
    );
    expect(rows).toHaveLength(titles.length);
    for (const row of rows)
      expect(JSON.parse(row.roles), row.title_zh).toEqual(
        suggestJobRoles({
          titleZh: row.title_zh,
          titleEn: row.title_en,
          industry: row.industry as Parameters<typeof suggestJobRoles>[0]["industry"],
        }),
      );
    expect(JSON.parse(rows.at(-2)!.roles)).toEqual([]); // 兼职: 待选
  });

  it("lets a candidate from a chat have no note or page, and lists who already chatted about a job (ADR 0030)", async () => {
    resetDbForTests();
    const journal = JSON.parse(readFileSync(path.join(projectRoot(), "drizzle", "meta", "_journal.json"), "utf8"));
    const before = migrationsUpTo(
      journal.entries.findIndex((e: { tag: string }) => e.tag.endsWith("_chat_candidates")),
    );
    made.push(before);
    const db = getDb();
    await migrate(db, { migrationsFolder: before });
    await db.run(sql`insert into employers (id, name, verification, region_id, created_at)
      values ('e1', '川味小馆', 'business_verified', 'akl-mt-eden', '2026-09-01')`);
    await db.run(sql`insert into jobs (id, country, employer_id, title_zh, title_en, industry, employment_type,
      region_id, pay_min_cents, meals_included, accommodation_included, visa_accepted, languages, description_zh,
      description_en, contact, status, posted_at, expires_at, urgent)
      values ('j1', 'NZ', 'e1', '前厅服务员', 'Front-of-house staff', 'hospitality', '["part_time"]', 'akl-mt-eden',
      2500, 1, 0, '["student"]', '[]', '点餐', 'Orders', '{}', 'active', '2026-10-10', '2026-11-09', 0)`);
    for (const email of ["applied@example.com", "chatted@example.com", "opened@example.com"])
      await db.run(sql`insert into accounts (email, created_at) values (${email}, '2026-10-01T00:00:00.000Z')`);
    await db.run(sql`insert into job_applications (id, seeker_email, job_id, employer_id, note, profile, applied_at,
      seen_at, decision, decided_at)
      values ('a1', 'applied@example.com', 'j1', 'e1', '周末可以', '{"name":"林晓"}', '2026-10-11T00:00:00.000Z',
      null, 'fit', '2026-10-12T00:00:00.000Z')`);
    await db.run(sql`insert into interviews (id, application_id, status, slots, call_first, place, note, reply,
      invited_at, created_at)
      values ('i1', 'a1', 'proposed', '[]', 0, '', '', '', '2026-10-12T00:00:00.000Z', '2026-10-12T00:00:00.000Z')`);
    for (const [id, email] of [
      ["c1", "applied@example.com"],
      ["c2", "chatted@example.com"],
      ["c3", "opened@example.com"],
    ])
      await db.run(sql`insert into conversations (id, seeker_email, employer_id, job_id, started_by, created_at)
        values (${id}, ${email}, 'e1', 'j1', 'seeker', '2026-10-13T00:00:00.000Z')`);
    await db.run(sql`insert into messages (conversation_id, from_role, text, sent_at) values
      ('c1', 'seeker', '你好', '2026-10-13T01:00:00.000Z'),
      ('c2', 'employer', '还在找工作吗', '2026-10-14T02:00:00.000Z'),
      ('c2', 'seeker', '在', '2026-10-14T01:00:00.000Z')`);

    await migrate(db, { migrationsFolder: path.join(projectRoot(), "drizzle") });

    const rows = await db.all(
      sql`select id, seeker_email, source, note, profile, applied_at, seen_at, decision
        from job_applications order by seeker_email`,
    );
    expect(rows).toEqual([
      {
        id: "a1",
        seeker_email: "applied@example.com",
        source: "apply",
        note: "周末可以",
        profile: '{"name":"林晓"}',
        applied_at: "2026-10-11T00:00:00.000Z",
        seen_at: null,
        decision: "fit",
      },
      {
        id: expect.stringMatching(/^[0-9a-f]{18}$/),
        seeker_email: "chatted@example.com",
        source: "chat",
        note: null,
        profile: null,
        applied_at: "2026-10-14T01:00:00.000Z",
        seen_at: "2026-10-14T01:00:00.000Z",
        decision: null,
      },
    ]);
    // The interview stays on its application.
    expect(await db.all(sql`select application_id from interviews`)).toEqual([{ application_id: "a1" }]);
  });
});
