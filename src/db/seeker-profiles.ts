// 求职者主页 on the server (#104): one per account. Only the account's own Server Functions read and write it. Server
// only.
import { eq } from "drizzle-orm";
import { database } from "@/db/ready";
import { accounts, seekerProfiles } from "@/db/schema";
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
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.email, address));
    if (!account) return "no_account";
    const [row] = await tx
      .insert(seekerProfiles)
      .values({ email: address, profile, updatedAt })
      .onConflictDoUpdate({ target: seekerProfiles.email, set: { profile, updatedAt } })
      .returning();
    return row;
  });
}
