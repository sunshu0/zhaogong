// 企业验证 applications (#78, PRD R-16, ADR 0011): submitted by an employer, decided by a moderator. Only the
// employer's and the moderators' Server Functions call this. Server only.
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import type { Checklist, Rejection, VerifyApplication } from "@/components/employer/verification";
import type { Employer } from "@/lib/types";

export type VerificationRequest = typeof t.verificationRequests.$inferSelect;

export type SubmitResult =
  | { status: "submitted"; request: VerificationRequest }
  | { status: "pending" } // this business already has one waiting
  | { status: "nzbn_pending" } // another business has one waiting for the same NZBN
  | { status: "nzbn_taken" }; // another business already carries this NZBN

/**
 * Records an application as pending. One pending application per business and per NZBN at a time, and not for an
 * NZBN another business already carries; checked in the same transaction as the insert.
 */
export async function submitVerification(
  employer: Pick<Employer, "id" | "name">,
  email: string,
  application: VerifyApplication & { legalName: string },
  now = new Date(),
): Promise<SubmitResult> {
  const db = await database();
  return db.transaction(async (tx) => {
    const pending = await tx
      .select({ employerId: t.verificationRequests.employerId, nzbn: t.verificationRequests.nzbn })
      .from(t.verificationRequests)
      .where(eq(t.verificationRequests.status, "pending"));
    if (pending.some((r) => r.employerId === employer.id)) return { status: "pending" };
    if (pending.some((r) => r.nzbn === application.nzbn)) return { status: "nzbn_pending" };
    const [taken] = await tx
      .select({ id: t.employers.id })
      .from(t.employers)
      .where(and(eq(t.employers.businessNumber, application.nzbn), ne(t.employers.id, employer.id)));
    if (taken) return { status: "nzbn_taken" };

    const [{ n }] = await tx.select({ n: sql<number>`count(*)` }).from(t.verificationRequests);
    const request: VerificationRequest = {
      id: `v${Number(n) + 1}`,
      employerId: employer.id,
      kind: application.kind,
      nzbn: application.nzbn,
      legalName: application.legalName,
      tradingName: employer.name,
      contactName: application.contactName,
      contactRole: application.contactRole,
      companyPhone: application.companyPhone,
      website: application.website ?? null,
      submittedByEmail: normalizeEmail(email),
      submittedAt: now.toISOString(),
      status: "pending",
      decidedAt: null,
      decidedByEmail: null,
      checklist: null,
      rejectReason: null,
      rejectNote: null,
    };
    await tx.insert(t.verificationRequests).values(request);
    return { status: "submitted", request };
  });
}

/** The business's latest application, whatever its status. */
export async function latestVerification(employerId: string): Promise<VerificationRequest | undefined> {
  const db = await database();
  const [row] = await db
    .select()
    .from(t.verificationRequests)
    .where(eq(t.verificationRequests.employerId, employerId))
    .orderBy(desc(t.verificationRequests.submittedAt), desc(t.verificationRequests.id))
    .limit(1);
  return row;
}

/** Every application of a business, oldest first (its decisions are the employer's notifications). */
export async function listVerifications(employerId: string): Promise<VerificationRequest[]> {
  const db = await database();
  return db
    .select()
    .from(t.verificationRequests)
    .where(eq(t.verificationRequests.employerId, employerId))
    .orderBy(asc(t.verificationRequests.submittedAt), asc(t.verificationRequests.id));
}

/** Applications waiting for a moderator, oldest first. */
export async function listPendingVerifications(): Promise<VerificationRequest[]> {
  const db = await database();
  return db
    .select()
    .from(t.verificationRequests)
    .where(eq(t.verificationRequests.status, "pending"))
    .orderBy(asc(t.verificationRequests.submittedAt), asc(t.verificationRequests.id));
}

export type Decision = { approve: true } | { approve: false; rejection: Rejection };

/**
 * Decides a pending application. Approving gives the business the badge with the register's name and NZBN (an
 * accredited employer keeps its higher badge). Returns undefined when the application is not pending any more.
 */
export async function decideVerification(
  id: string,
  moderator: string,
  checklist: Checklist,
  decision: Decision,
  now = new Date(),
): Promise<VerificationRequest | undefined> {
  const db = await database();
  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(t.verificationRequests).where(eq(t.verificationRequests.id, id));
    if (!request || request.status !== "pending") return undefined;
    const decided: VerificationRequest = {
      ...request,
      status: decision.approve ? "approved" : "rejected",
      decidedAt: now.toISOString(),
      decidedByEmail: normalizeEmail(moderator),
      checklist,
      rejectReason: decision.approve ? null : decision.rejection.reason,
      rejectNote: decision.approve ? null : decision.rejection.note,
    };
    await tx.update(t.verificationRequests).set(decided).where(eq(t.verificationRequests.id, id));
    if (decision.approve) {
      const [employer] = await tx.select().from(t.employers).where(eq(t.employers.id, request.employerId));
      const verification = employer?.verification === "accredited_employer" ? "accredited_employer" : request.kind;
      await tx
        .update(t.employers)
        .set({ verification, legalName: request.legalName, businessNumber: request.nzbn })
        .where(eq(t.employers.id, request.employerId));
    }
    return decided;
  });
}
