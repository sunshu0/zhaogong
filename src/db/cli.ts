// npm run db:migrate — apply the migrations in drizzle/ to the database DATABASE_URL points at.
// npm run db:seed — migrate, then load the demo data (src/mock) if the database is still empty.
// Both use the local file data/zhaogong.db unless DATABASE_URL says otherwise.
import { databaseUrl } from "@/db/client";
import { migrateDb } from "@/db/migrate";
import { isDatabaseEmpty, seedDemoData } from "@/db/seed";

async function main(command: string | undefined): Promise<number> {
  if (command !== "migrate" && command !== "seed") {
    console.error("Usage: tsx src/db/cli.ts migrate|seed");
    return 2;
  }
  await migrateDb();
  console.log(`Migrated ${databaseUrl()}`);
  if (command === "migrate") return 0;
  if (!(await isDatabaseEmpty())) {
    console.log("The database already has data; nothing loaded. For clean demo data: npm run db:reset, then db:seed.");
    return 0;
  }
  const n = await seedDemoData();
  console.log(`Loaded the demo data: ${n.employers} employers, ${n.jobs} jobs, ${n.contactViews} contact views.`);
  return 0;
}

main(process.argv[2]).then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
