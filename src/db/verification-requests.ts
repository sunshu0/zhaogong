// 企业验证 applications (#78, PRD R-16, ADR 0011): submitted by an employer, decided by a moderator. Only the
// employer's and the moderators' Server Functions call this. Server only.
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { insertIf, nextIdSql } from "@/db/write-if";
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
 * NZBN another business already carries; checked in the statement that inserts it.
 */
export async function submitVerification(
  employer: Pick<Employer, "id" | "name">,
  email: string,
  application: VerifyApplication & { legalName: string },
  now = new Date(),
): Promise<SubmitResult> {
  const db = await database();
  const v = t.verificationRequests;
  // One statement takes the next id and checks all three rules at the moment it writes (ADR 0031).
  const [request] = await insertIf(
    db,
    v,
    {
      id: nextIdSql(v, v.id, "v"),
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
    },
    sql`not exists (select 1 from ${v} where ${v.status} = 'pending' and (${v.employerId} = ${employer.id} or ${v.nzbn} = ${application.nzbn})) and not exists (select 1 from ${t.employers} where ${t.employers.businessNumber} = ${application.nzbn} and ${t.employers.id} <> ${employer.id})`,
  ).returning();
  if (request) return { status: "submitted", request };
  // Only to say why not.
  const pending = await db.select({ employerId: v.employerId, nzbn: v.nzbn }).from(v).where(eq(v.status, "pending"));
  if (pending.some((r) => r.employerId === employer.id)) return { status: "pending" };
  if (pending.some((r) => r.nzbn === application.nzbn)) return { status: "nzbn_pending" };
  return { status: "nzbn_taken" };
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
  const v = t.verificationRequests;
  const decidedAt = now.toISOString();
  const decidedByEmail = normalizeEmail(moderator);
  const status = decision.approve ? "approved" : "rejected";
  const decide = db
    .update(v)
    .set({
      status,
      decidedAt,
      decidedByEmail,
      checklist,
      rejectReason: decision.approve ? null : decision.rejection.reason,
      rejectNote: decision.approve ? null : decision.rejection.note,
    })
    .where(and(eq(v.id, id), eq(v.status, "pending")))
    .returning();
  if (!decision.approve) {
    const [decided] = await decide;
    return decided;
  }
  // One batch (ADR 0031): the business takes the approved facts only if this decision is the one just written, so a
  // second moderator deciding at the same moment changes nothing. An 认可雇主 badge stays.
  const field = (column: SQLiteColumn) => sql`(select ${column} from ${v} where ${v.id} = ${id})`;
  const [[decided]] = await db.batch([
    decide,
    db
      .update(t.employers)
      .set({
        verification: sql`case when ${t.employers.verification} = 'accredited_employer' then 'accredited_employer' else ${field(v.kind)} end`,
        legalName: field(v.legalName),
        businessNumber: field(v.nzbn),
      })
      .where(
        and(
          eq(t.employers.id, field(v.employerId)),
          sql`exists (select 1 from ${v} where ${v.id} = ${id} and ${v.status} = ${status} and ${v.decidedAt} = ${decidedAt} and ${v.decidedByEmail} = ${decidedByEmail})`,
        ),
      ),
  ]);
  return decided;
}
