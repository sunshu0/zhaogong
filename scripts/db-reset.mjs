// npm run db:reset: delete the local database file (data/zhaogong.db and its journal files). The next
// server start, or the next test run, migrates a fresh database and, in development, loads the demo data.
// Stop the dev server first: Windows will not delete a file that is open.
import { rmSync } from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL || "file:./data/zhaogong.db";
if (!url.startsWith("file:") || url.includes(":memory:")) {
  console.error(`db:reset only deletes a local database file; DATABASE_URL is ${url}.`);
  process.exit(1);
}
const file = path.resolve(url.slice("file:".length));
for (const f of [file, `${file}-wal`, `${file}-shm`, `${file}-journal`]) {
  try {
    rmSync(f, { force: true });
  } catch (error) {
    console.error(`${f} could not be deleted (${error.code}). Is the dev server still running?`);
    process.exit(1);
  }
}
console.log(`Deleted ${file}. The next start migrates a fresh database.`);
