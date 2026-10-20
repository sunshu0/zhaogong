// 求职者主页 on the server (#104): one per account. Only the account's own Server Functions read and write it. Server
// only.
import { desc, eq, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts, seekerProfiles } from "@/db/schema";
import { insertIf } from "@/db/write-if";
import { normalizeEmail } from "@/components/seeker/session";
import type { Profile } from "@/components/seeker/hub-state";

export type SeekerProfileRow = typeof seekerProfiles.$inferSelect;

export async function getSeekerProfile(email: string): Promise<SeekerProfileRow | undefined> {
  const db = await database();
  const [row] = await db
    .select()
    .from(seekerProfiles)
    .where(eq(seekerProfiles.email, normalizeEmail(email)));
  return row;
}

/** Replaces the account's page with this one (the browser always sends all it has). */
export async function saveSeekerProfile(
  email: string,
  profile: Partial<Profile>,
  now = new Date(),
): Promise<SeekerProfileRow | "no_account"> {
  const address = normalizeEmail(email);
  const updatedAt = now.toISOString();
  const db = await database();
  // One statement: the account must exist (ADR 0031).
  const [row] = await insertIf(
    db,
    seekerProfiles,
    { email: address, profile, updatedAt },
    sql`exists (select 1 from ${accounts} where ${accounts.email} = ${address})`,
  )
    .onConflictDoUpdate({ target: seekerProfiles.email, set: { profile, updatedAt } })
    .returning();
  return row ?? "no_account";
}

/** Pages whose owner allowed 推荐人才 (`resume.discoverable`); what an employer may see of them is decided later. */
export async function listDiscoverableSeekerProfiles(): Promise<SeekerProfileRow[]> {
  const db = await database();
  return db
    .select()
    .from(seekerProfiles)
    .where(sql`json_extract(${seekerProfiles.profile}, '$.resume.discoverable') = 1`)
    .orderBy(desc(seekerProfiles.updatedAt));
}
