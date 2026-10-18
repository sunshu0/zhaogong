// npm run db:migrate — apply the migrations in drizzle/ to the database DATABASE_URL points at.
// npm run db:seed — migrate, then load the demo data (src/mock) if the database is still empty, and import the real
// external jobs into it (demo-import.ts; offline, or with EXTERNAL_JOBS=demo, the made-up ones stay).
// npm run admin:grant <email> — make the account a moderator (creating the account if needed): how the first
// moderator comes about; after that moderators add each other in /admin. npm run admin:revoke <email> takes it away
// (never from the last one).
// npm run import:external [-- --dry-run] [company ids] — read the public job feeds of the companies in
// src/config/external-companies.ts and store the facts (Round 18, #111, ADR 0014). --dry-run prints the facts
// and stores nothing; it may read a company whose terms are not checked yet, to judge the facts before asking.
// A full import that read real jobs takes the demo's made-up external jobs down. New jobs wait in 审核后台.
// All use the local file data/zhaogong.db unless DATABASE_URL says otherwise.
import { EXTERNAL_COMPANIES } from "@/config/external-companies";
import { databaseUrl } from "@/db/client";
import { migrateDb } from "@/db/migrate";
import { grantModerator, revokeModerator } from "@/db/moderators";
import { isDatabaseEmpty, seedDemoData } from "@/db/seed";
import { ensureAccount } from "@/lib/data";
import { isValidEmail } from "@/components/seeker/session";
import { describeDemoImport, importRealJobsIntoDemo, retireDemoExternalJobs } from "@/lib/external-jobs/demo-import";
import { importExternalJobs, takeDownUnlisted } from "@/lib/external-jobs/import";
import { politeFetcher } from "@/lib/external-jobs/polite-fetch";

const USAGE =
  "Usage: tsx src/db/cli.ts migrate | seed | admin:grant <email> | admin:revoke <email> | import:external [--dry-run] [company ids]";

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

async function importExternal(args: string[]): Promise<number> {
  const dryRun = args.includes("--dry-run");
  const ids = args.filter((a) => !a.startsWith("--"));
  const unknown = ids.filter((id) => !EXTERNAL_COMPANIES.some((c) => c.id === id));
  if (unknown.length > 0) {
    console.error(
      `Not on the list: ${unknown.join(", ")}. Companies: ${EXTERNAL_COMPANIES.map((c) => c.id).join(", ")}`,
    );
    return 2;
  }
  const companies = ids.length > 0 ? EXTERNAL_COMPANIES.filter((c) => ids.includes(c.id)) : EXTERNAL_COMPANIES;
  const reports = await importExternalJobs({ companies, getJson: politeFetcher({ fetch }), dryRun });
  if (ids.length === 0 && !dryRun) reports.push(...(await takeDownUnlisted(EXTERNAL_COMPANIES)));
  if (ids.length === 0 && !dryRun && reports.some((r) => r.status === "imported" && r.kept > 0)) {
    const retired = await retireDemoExternalJobs();
    if (retired > 0) console.log(`demo data: took down ${retired} made-up external jobs`);
  }
  for (const r of reports) {
    if (r.status === "stopped") {
      console.log(
        `${r.company}: ${r.kind === "takedown" ? "removed at the company's request" : "stopped by a moderator"}, not read`,
      );
    } else if (r.status === "terms_not_checked") {
      console.log(`${r.company}: terms not checked, not read${r.takenDown ? `; took down ${r.takenDown}` : ""}`);
    } else if (r.status === "unlisted") {
      console.log(`${r.company}: no longer on the list, took down ${r.takenDown}`);
    } else if (r.status === "failed") {
      console.log(`${r.company}: could not read the feed (${r.error}); its jobs stay as they were`);
    } else if (r.status === "imported") {
      console.log(
        `${r.company}: ${r.inFeed} in the feed, ${r.kept} kept — ${r.added} new, ${r.updated} refreshed, ` +
          `${r.backToReview} back to review, ${r.removed} taken down`,
      );
    } else {
      console.log(`${r.company}: ${r.inFeed} in the feed, ${r.jobs.length} would be kept (dry run, nothing stored)`);
      for (const job of r.jobs) console.log(`  ${JSON.stringify(job)}`);
    }
  }
  return reports.some((r) => r.status === "failed") ? 1 : 0;
}

async function main(command: string | undefined, arg: string | undefined, rest: string[]): Promise<number> {
  if (command === "import:external") {
    await migrateDb();
    return importExternal(rest);
  }
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
  if (process.env.EXTERNAL_JOBS !== "demo") {
    console.log(describeDemoImport(await importRealJobsIntoDemo({ getJson: politeFetcher({ fetch }) })));
  }
  return 0;
}

main(process.argv[2], process.argv[3], process.argv.slice(3)).then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
