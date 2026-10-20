// A job's candidates (ADR 0030): job seekers who applied (一键申请, #84, R-35, until 10-20) or who wrote or were
// written to about the job, read by the job seeker (by email) and by the job's employer (by business and application
// id, never by email). Who may do what is checked by the Server Functions. Server only.
import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { database } from "@/db/ready";
import { conversations, interviews, jobApplications } from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import type { ApplicationDecision, ApplicationProfile } from "@/components/seeker/applications";

export type ApplicationRow = typeof jobApplications.$inferSelect;

export async function myApplication(email: string, jobId: string): Promise<ApplicationRow | undefined> {
  const db = await database();
  const [row] = await db
    .select()
    .from(jobApplications)
    .where(mine(normalizeEmail(email), jobId));
  return row;
}

/** The account's applications, newest first. */
export async function myApplications(email: string): Promise<ApplicationRow[]> {
  const db = await database();
  return db
    .select()
    .from(jobApplications)
    .where(eq(jobApplications.seekerEmail, normalizeEmail(email)))
    .orderBy(desc(jobApplications.appliedAt), desc(jobApplications.id));
}

/** Records an application; a second one for the same job is refused. */
export async function addApplication(input: {
  email: string;
  jobId: string;
  employerId: string;
  note: string;
  profile: ApplicationProfile;
  now?: Date;
}): Promise<ApplicationRow | "already"> {
  const email = normalizeEmail(input.email);
  const db = await database();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(jobApplications).where(mine(email, input.jobId));
    if (existing) return "already";
    const [row] = await tx
      .insert(jobApplications)
      .values({
        id: randomBytes(9).toString("base64url"),
        seekerEmail: email,
        jobId: input.jobId,
        employerId: input.employerId,
        note: input.note,
        profile: input.profile,
        appliedAt: (input.now ?? new Date()).toISOString(),
      })
      .returning();
    return row;
  });
}

/**
 * The job's candidate row for a shared conversation (ADR 0030), made when the first message is sent or the business
 * marks them, in the same transaction. A chat row has no note and no page, and counts as seen: the business saw the
 * conversation. An application already there stays as it is.
 */
export async function addChatCandidate(
  db: Pick<Awaited<ReturnType<typeof database>>, "insert">,
  conversation: { seekerEmail: string; employerId: string; jobId: string | null },
  at: string,
): Promise<void> {
  if (!conversation.jobId) return;
  await db
    .insert(jobApplications)
    .values({
      id: randomBytes(9).toString("base64url"),
      seekerEmail: conversation.seekerEmail,
      jobId: conversation.jobId,
      employerId: conversation.employerId,
      source: "chat",
      note: null,
      profile: null,
      appliedAt: at,
      seenAt: at,
    })
    .onConflictDoNothing({ target: [jobApplications.seekerEmail, jobApplications.jobId] });
}

/**
 * The candidate row of one of the business's shared conversations; undefined when there is none yet (nothing said)
 * or it is not theirs. `make`: add it if missing, for a mark made before anything was said.
 */
export async function chatCandidate(
  employerId: string,
  conversationId: string,
  make = false,
): Promise<ApplicationRow | undefined> {
  const db = await database();
  const [conversation] = await db.select().from(conversations).where(eq(conversations.id, conversationId));
  if (!conversation?.jobId || conversation.employerId !== employerId) return undefined;
  if (make) await addChatCandidate(db, conversation, new Date().toISOString());
  const [row] = await db.select().from(jobApplications).where(mine(conversation.seekerEmail, conversation.jobId));
  return row?.employerId === employerId ? row : undefined;
}

/** A job's applications for its business, oldest first. */
export async function jobApplicationsFor(employerId: string, jobId: string): Promise<ApplicationRow[]> {
  const db = await database();
  return db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.employerId, employerId), eq(jobApplications.jobId, jobId)))
    .orderBy(jobApplications.appliedAt, jobApplications.id);
}

/** The business has looked at the job's list: every application not yet seen is seen now. */
export async function markApplicationsSeen(employerId: string, jobId: string, now = new Date()): Promise<void> {
  const db = await database();
  await db
    .update(jobApplications)
    .set({ seenAt: now.toISOString() })
    .where(
      and(eq(jobApplications.employerId, employerId), eq(jobApplications.jobId, jobId), isNull(jobApplications.seenAt)),
    );
}

/** 合适, 不合适 or no decision, on one of the business's applications. False when it is not theirs. */
export async function decideApplication(
  employerId: string,
  id: string,
  decision: ApplicationDecision | null,
  now = new Date(),
): Promise<boolean> {
  const db = await database();
  const at = now.toISOString();
  const updated = await db
    .update(jobApplications)
    .set({ decision, decidedAt: decision ? at : null })
    .where(and(eq(jobApplications.employerId, employerId), eq(jobApplications.id, id)))
    .returning({ id: jobApplications.id, seenAt: jobApplications.seenAt });
  // Deciding means the business has seen it.
  if (updated.length && !updated[0].seenAt)
    await db.update(jobApplications).set({ seenAt: at }).where(eq(jobApplications.id, id));
  return updated.length > 0;
}

export async function applicationOf(employerId: string, id: string): Promise<ApplicationRow | undefined> {
  const db = await database();
  const [row] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.employerId, employerId), eq(jobApplications.id, id)));
  return row;
}

export type ApplicationCount = { total: number; unseen: number };

/**
 * For each of the business's jobs that has candidates: how many, and how many it has not looked at yet (only
 * applications: a chat row is seen when made).
 */
export async function applicationCounts(
  employerId: string,
  jobIds?: string[],
): Promise<Record<string, ApplicationCount>> {
  const db = await database();
  const rows = await db
    .select({ jobId: jobApplications.jobId, seenAt: jobApplications.seenAt })
    .from(jobApplications)
    .where(
      jobIds
        ? and(eq(jobApplications.employerId, employerId), inArray(jobApplications.jobId, jobIds))
        : eq(jobApplications.employerId, employerId),
    );
  const counts: Record<string, ApplicationCount> = {};
  for (const row of rows) {
    const count = (counts[row.jobId] ??= { total: 0, unseen: 0 });
    count.total += 1;
    if (!row.seenAt) count.unseen += 1;
  }
  return counts;
}

/** The business's applications it has not looked at yet, newest first: for 待办 and 通知. */
export async function unseenApplications(employerId: string): Promise<ApplicationRow[]> {
  const db = await database();
  return db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.employerId, employerId), isNull(jobApplications.seenAt)))
    .orderBy(desc(jobApplications.appliedAt));
}

/** The business's latest applications, newest first: for 通知. Not chat rows: the conversation says it already. */
export async function applicationsOfBusiness(employerId: string, limit = 30): Promise<ApplicationRow[]> {
  const db = await database();
  return db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.employerId, employerId), eq(jobApplications.source, "apply")))
    .orderBy(desc(jobApplications.appliedAt), desc(jobApplications.id))
    .limit(limit);
}

export type ApplicationFunnel = { applied: number; interviewed: number; hired: number };

/**
 * For 职位数据 (#105, R-31): how many are the job's candidates (applied or chatted, ADR 0030), how many of them were
 * invited to an interview that was not cancelled, and how many were hired.
 */
export async function applicationFunnel(employerId: string, jobId: string): Promise<ApplicationFunnel> {
  const rows = await jobApplicationsFor(employerId, jobId);
  const db = await database();
  const invited = rows.length
    ? await db
        .select({ status: interviews.status })
        .from(interviews)
        .where(
          inArray(
            interviews.applicationId,
            rows.map((row) => row.id),
          ),
        )
    : [];
  return {
    applied: rows.length,
    interviewed: invited.filter((i) => i.status !== "cancelled").length,
    hired: rows.filter((row) => row.decision === "hired").length,
  };
}

function mine(email: string, jobId: string) {
  return and(eq(jobApplications.seekerEmail, email), eq(jobApplications.jobId, jobId));
}
