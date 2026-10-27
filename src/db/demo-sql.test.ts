import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoDataSql, parentsFirst } from "@/db/demo-sql";
import { seedDemoData } from "@/db/seed";
import * as schema from "@/db/schema";
import { MOCK_JOBS } from "@/mock/data";
import { d1Binding, freshenD1ForTests, resetDbForTests } from "@/db/client";

const clients: Client[] = [];
async function freshDatabase() {
  const client = createClient({ url: "file::memory:" });
  clients.push(client);
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  return client;
}

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
  vi.unstubAllEnvs();
});

describe("offline demo bootstrap SQL", () => {
  it.skipIf(!d1Binding())("imports and refuses a repeat import on the actual local D1 engine", async () => {
    resetDbForTests();
    await freshenD1ForTests();
    const d1 = d1Binding()!;
    const artifact = await demoDataSql();
    const statements = () => artifact.statements.map((statement) => d1.prepare(statement));
    await d1.batch(statements());
    expect(await d1.prepare("SELECT count(*) AS n FROM jobs").first("n")).toBe(23);
    await expect(d1.batch(statements())).rejects.toThrow(/NOT NULL/);
    expect(await d1.prepare("SELECT count(*) AS n FROM jobs").first("n")).toBe(23);
    expect(await d1.prepare("SELECT count(*) AS n FROM write_guards").first("n")).toBe(0);
    expect((await d1.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
  });

  it("recreates the fixtures exactly without reading DATABASE_URL or changing the schema", async () => {
    vi.stubEnv("DATABASE_URL", "file:/this-database-must-never-be-opened/demo.db");
    // The day of the newest fixed-date fixture (2026-10-11): nothing is moved, so the rows are the seed's exactly.
    const now = Date.parse("2026-10-11T09:00:00Z");
    const artifact = await demoDataSql(now);
    const target = await freshDatabase();
    await target.batch(artifact.statements, "write");
    const original = await freshDatabase();
    await seedDemoData(drizzle(original, { schema }), now);
    const tables = await original.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
    );
    let rows = 0;
    for (const table of tables.rows) {
      const sql = `SELECT * FROM "${String(table.name)}" ORDER BY rowid`;
      const before = await original.execute(sql);
      const after = await target.execute(sql);
      expect(after.rows, String(table.name)).toEqual(before.rows);
      rows += before.rows.length;
    }
    expect(artifact.rows).toBe(rows);
    expect(rows).toBeGreaterThan(80);
    expect(artifact.sql).not.toMatch(/CREATE TABLE|DROP TABLE|INSERT OR REPLACE|BEGIN TRANSACTION/i);
    expect((await target.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
    expect((await target.execute("SELECT * FROM write_guards")).rows).toEqual([]);
  });

  it("dates the fixed-date jobs from the day of the export, so a later import still lists open jobs", async () => {
    const now = Date.parse("2026-12-01T05:00:00Z");
    const artifact = await demoDataSql(now);
    const target = await freshDatabase();
    await target.batch(artifact.statements, "write");
    // The fixed-date fixtures are j1–j19; the showcase's own (j20 closing in 2 days, j21 closed 20 days ago) are
    // dated from `now` on purpose.
    const fixtures = MOCK_JOBS.map((job) => `'${job.id}'`).join(", ");
    const active = await target.execute(
      `SELECT min(expires_at) AS first, max(posted_at) AS newest FROM jobs WHERE status = 'active' AND id IN (${fixtures})`,
    );
    expect(Date.parse(String(active.rows[0].first))).toBeGreaterThanOrEqual(now + 14 * 86_400_000);
    expect(String(active.rows[0].newest).slice(0, 10)).toBe("2026-12-01");
    // What is expired stays expired: j17–j19 by their status, j21 by its date.
    const expired = await target.execute("SELECT id FROM jobs WHERE status = 'expired' ORDER BY id");
    expect(expired.rows.map((row) => row.id)).toEqual(["j17", "j18", "j19"]);
    // ...and their end dates are before the export, though moved forward they would fall days after it.
    const ends = await target.execute(
      "SELECT expires_at, posted_at, hires_confirmed_at FROM jobs WHERE status = 'expired'",
    );
    for (const row of ends.rows) {
      expect(Date.parse(String(row.expires_at))).toBeLessThan(now);
      expect(Date.parse(String(row.expires_at))).toBeGreaterThan(Date.parse(String(row.posted_at)));
      expect(Date.parse(String(row.expires_at))).toBeGreaterThan(Date.parse(String(row.hires_confirmed_at)));
    }
    const closed = await target.execute("SELECT expires_at FROM jobs WHERE id = 'j21'");
    expect(Date.parse(String(closed.rows[0].expires_at))).toBe(now - 20 * 86_400_000);
    const views = await target.execute("SELECT min(viewed_at) AS first FROM contact_views");
    expect(String(views.rows[0].first) >= "2026-11-27").toBe(true);
    expect(artifact.sql).toMatch(/^-- .*Apply migrations 0000-\d{4}_[a-z0-9_]+ first\./);
    expect(artifact.sql).toContain("Dated for 2026-12-01: the fixed-date demo jobs were moved 51 days forward.");
  });

  it("imports statement by statement with foreign keys checked at once: parent rows come first (B-17)", async () => {
    const artifact = await demoDataSql();
    const target = await freshDatabase();
    await target.execute("PRAGMA foreign_keys = ON");
    expect((await target.execute("PRAGMA foreign_keys")).rows[0].foreign_keys).toBe(1);
    // As D1's remote import does: no deferring, each INSERT checked as it runs.
    let failed = 0;
    for (const statement of artifact.statements.filter((s) => !s.startsWith("PRAGMA"))) {
      await target.execute(statement).catch(() => failed++);
    }
    expect(failed).toBe(0);
    expect(artifact.statements[1]).toMatch(/^INSERT INTO "write_guards"/);
    expect((await target.execute("PRAGMA foreign_key_check")).rows).toEqual([]);
    expect((await target.execute("SELECT count(*) AS n FROM jobs")).rows[0].n).toBe(23);
  });

  it("refuses a nonempty target even if it has no employers, preserving its data", async () => {
    const artifact = await demoDataSql();
    const target = await freshDatabase();
    await target.execute(
      "INSERT INTO accounts (email, created_at, last_role) VALUES ('existing@example.com', '2026-10-22', 'seeker')",
    );
    await expect(target.batch(artifact.statements, "write")).rejects.toThrow(/NOT NULL/);
    expect((await target.execute("SELECT email FROM accounts")).rows).toEqual([{ email: "existing@example.com" }]);
    expect((await target.execute("SELECT * FROM employers")).rows).toEqual([]);
  });

  it("orders tables after the tables they point to, by name otherwise, and stops on a cycle", () => {
    const parents = new Map([
      ["contact_views", ["jobs", "accounts"]],
      ["jobs", ["employers"]],
      ["employers", []],
      ["accounts", []],
      ["write_guards", []],
    ]);
    expect(parentsFirst(parents)).toEqual(["accounts", "employers", "jobs", "contact_views", "write_guards"]);
    expect(() =>
      parentsFirst(
        new Map([
          ["a", ["b"]],
          ["b", ["a"]],
        ]),
      ),
    ).toThrow(/cycle \(a → b → a\)/);
    expect(() => parentsFirst(new Map([["replies", ["replies"]]]))).toThrow(/cycle \(replies → replies\)/);
  });

  it("refuses a second import without adding to or replacing existing fixtures", async () => {
    const artifact = await demoDataSql();
    const target = await freshDatabase();
    await target.batch(artifact.statements, "write");
    await expect(target.batch(artifact.statements, "write")).rejects.toThrow(/NOT NULL/);
    expect((await target.execute("SELECT count(*) AS n FROM accounts")).rows[0].n).toBe(3);
    expect((await target.execute("SELECT * FROM write_guards")).rows).toEqual([]);
  });
});
