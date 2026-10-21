// The migrations as wrangler applies them to D1 and as drizzle's migrator applies them locally make the same database
// (ADR 0031), and nothing in them is something D1 refuses.
import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import { drizzle } from "drizzle-orm/libsql";
import { describe, expect, it } from "vitest";
import { migrationFiles } from "@/db/d1-migrations";

const folder = path.join(process.cwd(), "drizzle");

async function schemaOf(client: ReturnType<typeof createClient>): Promise<string[]> {
  const { rows } = await client.execute(
    "select type, name, sql from sqlite_master where name not like 'sqlite_%' and name not like '__drizzle%' order by type, name",
  );
  return rows.map((row) => `${row.type} ${row.name}: ${String(row.sql).replace(/\s+/g, " ")}`);
}

describe("migrations for D1 (ADR 0031)", () => {
  it("lists every .sql file in the journal, and every journal entry has its file", () => {
    const journal = JSON.parse(readFileSync(path.join(folder, "meta", "_journal.json"), "utf8")) as {
      entries: { tag: string }[];
    };
    expect(migrationFiles().map((f) => f.name)).toEqual(journal.entries.map((e) => `${e.tag}.sql`).sort());
  });

  it("has no transaction statements and does not switch foreign keys off (D1 refuses both)", () => {
    for (const file of migrationFiles())
      for (const statement of file.statements) {
        expect(statement, file.name).not.toMatch(/^\s*(begin|commit|rollback|end)\b/im);
        expect(statement, file.name).not.toMatch(/pragma\s+foreign_keys/i);
      }
  });

  it("makes the same tables and indexes applied file by file, as wrangler does, as drizzle's migrator makes", async () => {
    const byFile = createClient({ url: "file::memory:" });
    for (const file of migrationFiles()) await byFile.batch(file.statements, "write");
    const byMigrator = createClient({ url: "file::memory:" });
    await migrate(drizzle(byMigrator), { migrationsFolder: folder });
    expect(await schemaOf(byFile)).toEqual(await schemaOf(byMigrator));
    byFile.close();
    byMigrator.close();
  });
});
