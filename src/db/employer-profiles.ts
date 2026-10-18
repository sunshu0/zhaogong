// 企业主页 on the server (ADR 0022): one per business. Everyone in the team and every visitor reads it; only an admin
// of the business writes it, checked again inside the transaction that writes. Server only.
import { and, eq, inArray, isNull } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import { canEditPage, type EmployerPage } from "@/components/employer/employer-page";

export type EmployerPageRow = typeof t.employerProfiles.$inferSelect;

export async function getEmployerPage(employerId: string): Promise<EmployerPageRow | undefined> {
  const db = await database();
  const [row] = await db.select().from(t.employerProfiles).where(eq(t.employerProfiles.employerId, employerId));
  return row;
}

/** The pages of these businesses that have one, with each business's name; banned businesses are left out. */
export async function listPublicEmployerPages(
  employerIds: readonly string[],
): Promise<{ employerId: string; businessName: string; page: EmployerPage }[]> {
  if (!employerIds.length) return [];
  const db = await database();
  return db
    .select({
      employerId: t.employerProfiles.employerId,
      businessName: t.employers.name,
      page: t.employerProfiles.page,
    })
    .from(t.employerProfiles)
    .innerJoin(t.employers, eq(t.employers.id, t.employerProfiles.employerId))
    .where(and(inArray(t.employerProfiles.employerId, [...employerIds]), isNull(t.employers.bannedAt)));
}

/**
 * Replaces the page of the account's business with this one (the browser always sends all it has). Only an admin of
 * the business may; an account from before teams counts as its business's admin, as everywhere (#87).
 */
export async function saveEmployerPage(
  email: string,
  page: EmployerPage,
  now = new Date(),
): Promise<EmployerPageRow | "no_business" | "not_admin"> {
  const address = normalizeEmail(email);
  const updatedAt = now.toISOString();
  const db = await database();
  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(t.accounts).where(eq(t.accounts.email, address));
    if (!account?.employerId) return "no_business";
    if (!canEditPage(account.teamRole ?? "admin")) return "not_admin";
    const [row] = await tx
      .insert(t.employerProfiles)
      .values({ employerId: account.employerId, page, updatedAt, updatedByEmail: address })
      .onConflictDoUpdate({
        target: t.employerProfiles.employerId,
        set: { page, updatedAt, updatedByEmail: address },
      })
      .returning();
    return row;
  });
}
