// Generate a reviewable SQL artifact locally. This command never connects to Cloudflare.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { demoDataSql } from "../src/db/demo-sql.ts";

async function main() {
  const { values } = parseArgs({
    strict: true,
    options: { output: { type: "string", default: "data/d1-demo.sql" } },
  });
  if (!values.output?.trim()) throw new Error("--output needs a file path.");
  const output = path.resolve(values.output);
  const { sql, rows } = await demoDataSql();
  await mkdir(path.dirname(output), { recursive: true });
  // A typo must not overwrite an existing backup or a previously reviewed artifact.
  await writeFile(output, sql, { encoding: "utf8", flag: "wx" });
  console.log(`Generated ${rows} synthetic fixture rows: ${output}`);
  console.log("Review the SQL, then import only into a fresh, migrated DEMO D1 database. Nothing was uploaded.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
