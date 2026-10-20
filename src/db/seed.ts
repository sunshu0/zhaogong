// The demo data (src/mock), loaded into an empty database: the dev server's first start, tests, or
// npm run db:reset.
import { count } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { DEMO_SEEKER, demoShowcase } from "@/db/demo-showcase";
import { DEMO_MODERATOR } from "@/lib/demo-accounts";
import { fromEmployer, fromJob } from "@/db/rows";
import * as schema from "@/db/schema";
import { insertsInChunks } from "@/db/write-if";
import { normalizeEmploymentTypes } from "@/lib/employment-types";
import { suggestJobRoles } from "@/lib/job-roles";
import { MOCK_CONTACT_VIEWS, MOCK_EMPLOYERS, MOCK_JOBS } from "@/mock/data";
import { demoExternalJobs } from "@/mock/external-jobs";

/**
 * The demo moderator (#50): in the demo data only, so a developer (and the browser tests) can open /admin by signing
 * in with this address; outside production the sign-in page shows the code. A real database starts with no
 * moderator: npm run admin:grant makes the first one.
 */
export { DEMO_MODERATOR };

/** True when no business has been written yet: neither the demo data nor anything else. */
export async function isDatabaseEmpty(db: Db = getDb()): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(schema.employers);
  return n === 0;
}

/**
 * Inserts the demo employers, jobs and contact views with their usual ids (e1…, j1…), and what shows the newer
 * features in use (demo-showcase.ts, #88): jobs closing soon or long closed, the moderation queue, a job seeker's
 * saved jobs and alert. Those are dated from `now`.
 */
export async function seedDemoData(
  db: Db = getDb(),
  now = Date.now(),
): Promise<{ employers: number; jobs: number; contactViews: number }> {
  const showcase = demoShowcase(now);
  const at = new Date(now).toISOString();
  // One batch, each statement under D1's 100 parameters (ADR 0031): all of the demo data goes in, or none of it.
  const [first, ...rest] = [
    ...insertsInChunks(db, schema.employers, MOCK_EMPLOYERS.map(fromEmployer)),
    ...insertsInChunks(
      db,
      schema.jobs,
      [...MOCK_JOBS, ...showcase.jobs].map((job) =>
        fromJob({
          ...job,
          employmentType: normalizeEmploymentTypes(job.employmentType),
          roles: job.roles ?? suggestJobRoles(job),
          contactPublic: !!job.contactPublic,
        }),
      ),
    ),
    ...insertsInChunks(
      db,
      schema.contactViews,
      MOCK_CONTACT_VIEWS.map((v) => ({ ...v })),
    ),
    ...insertsInChunks(db, schema.accounts, [
      { email: DEMO_MODERATOR, createdAt: at, lastRole: "seeker" },
      { email: DEMO_SEEKER, createdAt: showcase.alert.createdAt, lastRole: "seeker" },
    ]),
    db.insert(schema.moderators).values({ email: DEMO_MODERATOR, grantedAt: at, grantedBy: null }),
    ...insertsInChunks(
      db,
      schema.reports,
      showcase.reports.map((r) => ({ ...r, note: r.note ?? null })),
    ),
    ...insertsInChunks(db, schema.savedJobs, showcase.savedJobs),
    db.insert(schema.jobAlerts).values(showcase.alert),
    db.insert(schema.jobAlertHits).values(showcase.alertHit),
    ...insertsInChunks(db, schema.verificationRequests, showcase.verifications),
    ...insertsInChunks(db, schema.externalJobs, demoExternalJobs(now)), // #112, #113
  ];
  await db.batch([first, ...rest]);
  return {
    employers: MOCK_EMPLOYERS.length,
    jobs: MOCK_JOBS.length + showcase.jobs.length,
    contactViews: MOCK_CONTACT_VIEWS.length,
  };
}
