// The demo data (src/mock), loaded into an empty database: the dev server's first start, tests, or
// npm run db:reset.
import { count } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { fromEmployer, fromJob } from "@/db/rows";
import * as schema from "@/db/schema";
import { normalizeEmploymentTypes } from "@/lib/employment-types";
import { MOCK_CONTACT_VIEWS, MOCK_EMPLOYERS, MOCK_JOBS } from "@/mock/data";

/**
 * The demo moderator (#50): in the demo data only, so a developer (and the browser tests) can open /admin by signing
 * in with this address; outside production the sign-in page shows the code. A real database starts with no
 * moderator: npm run admin:grant makes the first one.
 */
export const DEMO_MODERATOR = "moderator@example.com";

/** True when no business has been written yet: neither the demo data nor anything else. */
export async function isDatabaseEmpty(db: Db = getDb()): Promise<boolean> {
  const [{ n }] = await db.select({ n: count() }).from(schema.employers);
  return n === 0;
}

/** Inserts the demo employers, jobs and contact views with their usual ids (e1…, j1…). */
export async function seedDemoData(
  db: Db = getDb(),
): Promise<{ employers: number; jobs: number; contactViews: number }> {
  await db.transaction(async (tx) => {
    await tx.insert(schema.employers).values(MOCK_EMPLOYERS.map(fromEmployer));
    await tx.insert(schema.jobs).values(
      MOCK_JOBS.map((job) =>
        fromJob({
          ...job,
          employmentType: normalizeEmploymentTypes(job.employmentType),
          contactPublic: !!job.contactPublic,
        }),
      ),
    );
    if (MOCK_CONTACT_VIEWS.length)
      await tx.insert(schema.contactViews).values(MOCK_CONTACT_VIEWS.map((v) => ({ ...v })));
    const now = new Date().toISOString();
    await tx.insert(schema.accounts).values({ email: DEMO_MODERATOR, createdAt: now, lastRole: "seeker" });
    await tx.insert(schema.moderators).values({ email: DEMO_MODERATOR, grantedAt: now, grantedBy: null });
  });
  return { employers: MOCK_EMPLOYERS.length, jobs: MOCK_JOBS.length, contactViews: MOCK_CONTACT_VIEWS.length };
}
