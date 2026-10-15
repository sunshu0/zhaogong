// npm run db:migrate — apply the migrations in drizzle/ to the database DATABASE_URL points at.
// npm run db:seed — migrate, then load the demo data (src/mock) if the database is still empty.
// npm run admin:grant <email> — make the account a moderator (creating the account if needed): how the first
// moderator comes about; after that moderators add each other in /admin. npm run admin:revoke <email> takes it away
// (never from the last one).
// All use the local file data/zhaogong.db unless DATABASE_URL says otherwise.
import { databaseUrl } from "@/db/client";
import { migrateDb } from "@/db/migrate";
import { grantModerator, revokeModerator } from "@/db/moderators";
import { isDatabaseEmpty, seedDemoData } from "@/db/seed";
import { ensureAccount } from "@/lib/data";
import { isValidEmail } from "@/components/seeker/session";

const USAGE = "Usage: tsx src/db/cli.ts migrate | seed | admin:grant <email> | admin:revoke <email>";

async function moderator(command: "admin:grant" | "admin:revoke", email: string | undefined): Promise<number> {
  if (!email || !isValidEmail(email)) {
    console.error(`${USAGE}\nGive the account's email.`);
    return 2;
  }
  if (command === "admin:grant") {
    await ensureAccount(email);
    const result = await grantModerator(email, null);
    console.log(result === "already" ? `${email} is already a moderator.` : `${email} is now a moderator.`);
    return 0;
  }
  const result = await revokeModerator(email);
  if (result === "last") {
    console.error(`${email} is the last moderator; grant someone else first.`);
    return 1;
  }
  console.log(result === "not_moderator" ? `${email} is not a moderator.` : `${email} is no longer a moderator.`);
  return 0;
}

async function main(command: string | undefined, arg: string | undefined): Promise<number> {
  if (command === "admin:grant" || command === "admin:revoke") {
    await migrateDb();
    return moderator(command, arg);
  }
  if (command !== "migrate" && command !== "seed") {
    console.error(USAGE);
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

main(process.argv[2], process.argv[3]).then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
