// npm run db:migrate — apply the migrations in drizzle/ to the database DATABASE_URL points at.
// npm run db:seed — migrate, then load the demo data (src/mock) if the database is still empty, and import the real
// external jobs into it (demo-import.ts; offline, or with EXTERNAL_JOBS=demo, the made-up ones stay).
// npm run admin:grant <email> — make the account a moderator (creating the account if needed; never one with a job
// seeker's or employer's data); after that the admins (ZHAOGONG_ADMIN_EMAILS, ADR 0043) add them in /admin.
// npm run admin:revoke <email> takes it away. Both go into the record of moderator changes as done from here.
// npm run import:external [-- --dry-run] [company ids] — read the public job feeds of the companies in
// src/config/external-companies.ts and store the facts (Round 18, #111, ADR 0014). --dry-run prints the facts
// and stores nothing; it may read a company whose terms are not checked yet, to judge the facts before asking.
// A full import that read real jobs takes the demo's made-up external jobs down. New jobs wait in 审核后台.
// All use the local file data/zhaogong.db unless DATABASE_URL says otherwise.
import { EXTERNAL_COMPANIES } from "@/config/external-companies";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { d1Binding, databaseUrl, setCommandLineD1, type D1Binding } from "@/db/client";
import { DATABASE_USAGE as USAGE, parseDatabaseArguments } from "@/db/cli-args";
import { migrateDb } from "@/db/migrate";
import { grantModerator, revokeModerator } from "@/db/moderators";
import { isDatabaseEmpty, seedDemoData } from "@/db/seed";
import { ensureAccount } from "@/lib/data";
import { isValidEmail } from "@/components/seeker/session";
import { retireDemoExternalJobs, runDemoImport } from "@/lib/external-jobs/demo-import";
import { importExternalJobs, importSummary, takeDownUnlisted } from "@/lib/external-jobs/import";
import { politeFetcher } from "@/lib/external-jobs/polite-fetch";

async function prepareDatabase(): Promise<void> {
  // D1 migrations are applied before opening the proxy. Node databases use Drizzle's local migrator.
  if (!d1Binding()) await migrateDb();
}

async function moderator(command: "admin:grant" | "admin:revoke", email: string | undefined): Promise<number> {
  if (!email || !isValidEmail(email)) {
    console.error(`${USAGE}\nGive the account's email.`);
    return 2;
  }
  if (command === "admin:grant") {
    await ensureAccount(email);
    const result = await grantModerator(email, null);
    if (result === "no_account") {
      console.error("The account was removed before permission could be granted; try again.");
      return 1;
    }
    if (result === "has_data") {
      console.error(`${email} has a job seeker's or employer's data; use an address kept for moderating only.`);
      return 1;
    }
    console.log(result === "already" ? `${email} is already a moderator.` : `${email} is now a moderator.`);
    return 0;
  }
  const result = await revokeModerator(email, null);
  if (result === "admin") {
    console.error(`${email} is an admin (ZHAOGONG_ADMIN_EMAILS); take it out of that setting instead.`);
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
  console.log(importSummary(reports));
  return reports.some((r) => r.status === "failed") ? 1 : 0;
}

async function main(command: string | undefined, arg: string | undefined, rest: string[]): Promise<number> {
  if (command === "import:external") {
    await prepareDatabase();
    return importExternal(rest);
  }
  if (command === "admin:grant" || command === "admin:revoke") {
    await prepareDatabase();
    return moderator(command, arg);
  }
  if (command !== "migrate" && command !== "seed") {
    console.error(USAGE);
    return 2;
  }
  await prepareDatabase();
  console.log(d1Binding() ? "Using local D1 (migrations applied)." : `Migrated ${databaseUrl()}`);
  if (command === "migrate") return 0;
  if (!(await isDatabaseEmpty())) {
    console.log("The database already has data; nothing loaded.");
    if (!d1Binding()) console.log("For clean local libSQL demo data: npm run db:reset, then db:seed.");
    return 0;
  }
  const n = await seedDemoData();
  console.log(`Loaded the demo data: ${n.employers} employers, ${n.jobs} jobs, ${n.contactViews} contact views.`);
  if (process.env.EXTERNAL_JOBS !== "demo") {
    console.log(await runDemoImport()); // never fails the seed: offline, the made-up jobs stay
  }
  return 0;
}

async function run(): Promise<number> {
  const { command, args: cleanArgs, localD1, persistTo } = parseDatabaseArguments(process.argv.slice(2));
  if ((command === "admin:grant" || command === "admin:revoke") && !isValidEmail(cleanArgs[0])) {
    console.error(`${USAGE}\nGive the account's email.`);
    return 2;
  }
  if (!localD1) return main(command, cleanArgs[0], cleanArgs);
  const runFile = promisify(execFile);
  await runFile(
    process.execPath,
    [
      path.resolve("node_modules/wrangler/bin/wrangler.js"),
      "d1",
      "migrations",
      "apply",
      "zhaogong",
      "--local",
      "--persist-to",
      path.resolve(persistTo),
    ],
    { env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, maxBuffer: 2 * 1024 * 1024 },
  );
  console.log(`Local D1 migrations are up to date (${path.resolve(persistTo)}).`);
  const { getPlatformProxy } = await import("wrangler");
  const proxy = await getPlatformProxy<{ DB: D1Binding }>({
    configPath: path.resolve("wrangler.jsonc"),
    persist: { path: path.resolve(persistTo, "v3") },
    remoteBindings: false,
  });
  try {
    setCommandLineD1(proxy.env.DB);
    return await main(command, cleanArgs[0], cleanArgs);
  } finally {
    setCommandLineD1(undefined);
    await proxy.dispose();
  }
}

run().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
