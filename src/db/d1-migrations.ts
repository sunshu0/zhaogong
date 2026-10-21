// The migrations as wrangler applies them to D1 (ADR 0031): every .sql file in drizzle/, in file-name order, each
// split at drizzle's `--> statement-breakpoint` lines. Local libSQL databases keep drizzle's migrator (src/db/migrate.ts);
// both read the same files. The D1 tests apply them with this, and migrations.test.ts checks both ways agree.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export interface MigrationFile {
  name: string;
  statements: string[];
}

export function migrationFiles(folder = path.join(process.cwd(), "drizzle")): MigrationFile[] {
  const names = readdirSync(folder)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  return names.map((name) => ({
    name,
    statements: readFileSync(path.join(folder, name), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean),
  }));
}
