import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { moderatorBootstrapSql } from "../src/db/moderator-sql.ts";

async function main() {
  const { values, positionals } = parseArgs({
    strict: true,
    allowPositionals: true,
    options: { output: { type: "string", default: "data/d1-moderator.sql" } },
  });
  if (positionals.length !== 1 || !values.output?.trim()) {
    throw new Error("Usage: npm run admin:grant-sql -- <email> [--output <file>]");
  }
  const { sql } = moderatorBootstrapSql(positionals[0]);
  const output = path.resolve(values.output);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, sql, { encoding: "utf8", flag: "wx" });
  console.log(`Moderator bootstrap SQL: ${output}`);
  console.log(
    "Review the target email and database before importing. No permission was granted; nothing was uploaded.",
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
