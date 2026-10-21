import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoDataSql } from "@/db/demo-sql";
import { seedDemoData } from "@/db/seed";
import * as schema from "@/db/schema";
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
    const now = Date.parse("2026-10-22T00:00:00Z");
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

  it("refuses a second import without adding to or replacing existing fixtures", async () => {
    const artifact = await demoDataSql();
    const target = await freshDatabase();
    await target.batch(artifact.statements, "write");
    await expect(target.batch(artifact.statements, "write")).rejects.toThrow(/NOT NULL/);
    expect((await target.execute("SELECT count(*) AS n FROM accounts")).rows[0].n).toBe(2);
    expect((await target.execute("SELECT * FROM write_guards")).rows).toEqual([]);
  });
});
