// The demo data (src/mock), loaded into an empty database: the dev server's first start, tests, or
// npm run db:reset.
import { count } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { fromEmployer, fromJob } from "@/db/rows";
import * as schema from "@/db/schema";
import { normalizeEmploymentTypes } from "@/lib/employment-types";
import { MOCK_CONTACT_VIEWS, MOCK_EMPLOYERS, MOCK_JOBS } from "@/mock/data";

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
  });
  return { employers: MOCK_EMPLOYERS.length, jobs: MOCK_JOBS.length, contactViews: MOCK_CONTACT_VIEWS.length };
}
