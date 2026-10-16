// 约面试 (#103): at most one interview per application. The employer reaches it through its own business's
// application; the job seeker through their own application. Who may do what is checked by the Server Functions,
// what an answer may be by parseResponse. Server only.
import { randomBytes } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { database } from "@/db/ready";
import { interviews, jobApplications } from "@/db/schema";
import { normalizeEmail } from "@/components/seeker/session";
import type { InterviewInvite, InterviewResponse, InterviewView } from "@/components/seeker/interviews";

export type InterviewRow = typeof interviews.$inferSelect;

export function interviewView(row: InterviewRow): InterviewView {
  return {
    slots: row.slots,
    callFirst: row.callFirst,
    mode: row.mode,
    place: row.place,
    note: row.note,
    status: row.status,
    chosenSlot: row.chosenSlot,
    reply: row.reply,
    invitedAt: row.invitedAt,
    respondedAt: row.respondedAt,
  };
}

export async function interviewsFor(applicationIds: string[]): Promise<Map<string, InterviewRow>> {
  if (!applicationIds.length) return new Map();
  const db = await database();
  const rows = await db.select().from(interviews).where(inArray(interviews.applicationId, applicationIds));
  return new Map(rows.map((row) => [row.applicationId, row]));
}

/** The business's application, or undefined when it is not theirs. */
async function businessApplication(employerId: string, applicationId: string) {
  const db = await database();
  const [row] = await db
    .select()
    .from(jobApplications)
    .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.employerId, employerId)));
  return row;
}

/**
 * Invites to an interview, or changes the invitation (new times, or after an answer): it is open again and the
 * earlier answer is cleared. False when the application is not the business's.
 */
export async function inviteToInterview(
  employerId: string,
  applicationId: string,
  invite: InterviewInvite,
  now = new Date(),
): Promise<InterviewRow | undefined> {
  if (!(await businessApplication(employerId, applicationId))) return undefined;
  const at = now.toISOString();
  const values = {
    ...invite,
    status: "proposed" as const,
    chosenSlot: null,
    reply: "",
    invitedAt: at,
    respondedAt: null,
  };
  const db = await database();
  const [row] = await db
    .insert(interviews)
    .values({ id: randomBytes(9).toString("base64url"), applicationId, createdAt: at, ...values })
    .onConflictDoUpdate({ target: interviews.applicationId, set: values })
    .returning();
  return row;
}

/** The employer calls it off; the job seeker is told. */
export async function cancelInterview(
  employerId: string,
  applicationId: string,
  now = new Date(),
): Promise<InterviewRow | undefined> {
  if (!(await businessApplication(employerId, applicationId))) return undefined;
  const db = await database();
  const [row] = await db
    .update(interviews)
    .set({ status: "cancelled", invitedAt: now.toISOString() })
    .where(eq(interviews.applicationId, applicationId))
    .returning();
  return row;
}

/** Records the job seeker's answer; the caller has parsed it against the interview as it is. */
export async function answerInterview(
  applicationId: string,
  response: InterviewResponse,
  now = new Date(),
): Promise<InterviewRow | undefined> {
  const db = await database();
  const [row] = await db
    .update(interviews)
    .set({
      status: response.kind === "confirm" ? "confirmed" : response.kind === "decline" ? "declined" : "counter",
      chosenSlot: response.kind === "confirm" ? response.slot : null,
      reply: response.kind === "confirm" ? "" : response.reply,
      respondedAt: now.toISOString(),
    })
    .where(and(eq(interviews.applicationId, applicationId), eq(interviews.status, "proposed")))
    .returning();
  return row;
}

/** The job seeker's interviews, with the application each is on. */
export async function interviewsOfSeeker(email: string) {
  const db = await database();
  return db
    .select({ interview: interviews, application: jobApplications })
    .from(interviews)
    .innerJoin(jobApplications, eq(interviews.applicationId, jobApplications.id))
    .where(eq(jobApplications.seekerEmail, normalizeEmail(email)));
}

/** The business's interviews, with the application each is on. */
export async function interviewsOfBusiness(employerId: string) {
  const db = await database();
  return db
    .select({ interview: interviews, application: jobApplications })
    .from(interviews)
    .innerJoin(jobApplications, eq(interviews.applicationId, jobApplications.id))
    .where(eq(jobApplications.employerId, employerId));
}
