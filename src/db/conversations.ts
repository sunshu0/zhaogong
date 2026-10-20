// The conversations a job seeker and a business share (#110, ADR 0015): one per job seeker account, business and job,
// with its messages and exchanges. Both sides read and write the same rows; src/lib/chat-server/shared-view.ts turns
// them into what each side sees. Server only.
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { addChatCandidate } from "@/db/job-applications";
import { normalizeEmail } from "@/components/seeker/session";
import type { SharedConversation, SharedExchange, Side } from "@/lib/chat-server/shared-view";
import type { ExchangeKind, ExchangePayload } from "@/lib/chat-consent";

export type ConversationRow = typeof t.conversations.$inferSelect;

/** Whose conversations: a job seeker account's, or a business's (everyone in its team). */
export type SharedReader = { side: "seeker"; email: string } | { side: "employer"; employerId: string };

const NAME_MAX = 40;

/** The reader's conversations with their messages and exchanges, oldest message first. */
export async function listSharedConversations(reader: SharedReader): Promise<SharedConversation[]> {
  const db = await database();
  const rows = await db
    .select({
      conversation: t.conversations,
      employerName: t.employers.name,
      jobTitle: t.jobs.titleZh,
      page: t.seekerProfiles.profile,
    })
    .from(t.conversations)
    .innerJoin(t.employers, eq(t.employers.id, t.conversations.employerId))
    .innerJoin(t.jobs, eq(t.jobs.id, t.conversations.jobId))
    .leftJoin(t.seekerProfiles, eq(t.seekerProfiles.email, t.conversations.seekerEmail))
    .where(
      reader.side === "seeker"
        ? eq(t.conversations.seekerEmail, normalizeEmail(reader.email))
        : eq(t.conversations.employerId, reader.employerId),
    );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.conversation.id);
  const messages = await db
    .select()
    .from(t.messages)
    .where(inArray(t.messages.conversationId, ids))
    .orderBy(asc(t.messages.id));
  const exchanges = await db
    .select()
    .from(t.exchanges)
    .where(inArray(t.exchanges.conversationId, ids))
    .orderBy(asc(t.exchanges.createdAt));
  return rows.map(({ conversation: c, employerName, jobTitle, page }) => {
    // The business sees the name on the job seeker's page as it is now; the one they applied or were found with
    // otherwise. Their 推荐人才 card only while they still let businesses find them.
    const resume = page?.resume;
    const candidateId = resume?.discoverable && resume.candidateId ? `local-${resume.candidateId}` : undefined;
    return {
      id: c.id,
      employerId: c.employerId,
      employerName,
      jobId: c.jobId!,
      jobTitle,
      startedBy: c.startedBy,
      seekerName: (page?.name?.trim() || c.seekerName || "求职者").slice(0, NAME_MAX),
      ...(candidateId ? { candidateId } : {}),
      seekerReadAt: c.seekerReadAt,
      employerReadAt: c.employerReadAt,
      updatedAt: c.updatedAt ?? c.createdAt,
      messages: messages
        .filter((m) => m.conversationId === c.id)
        .map((m) => ({ from: m.from, text: m.text, sentAt: m.sentAt, byName: m.byName })),
      exchanges: exchanges
        .filter((x) => x.conversationId === c.id)
        .map((x): SharedExchange => ({
          id: x.id,
          kind: x.kind,
          requestedBy: x.requestedBy,
          status: x.status,
          offered: x.offered,
          response: x.response ?? null,
          createdAt: x.createdAt,
          respondedAt: x.respondedAt,
        })),
    };
  });
}

/**
 * The name the business sees for each job seeker it has a conversation with, as listSharedConversations gives it
 * (their page's now, else the one they were found with), by seekerJobKey; empty when neither is known. For the job's
 * candidates who came from a chat (ADR 0030), whose row has no page.
 */
export async function seekerNamesOfBusiness(employerId: string): Promise<Map<string, string>> {
  const db = await database();
  const rows = await db
    .select({ conversation: t.conversations, page: t.seekerProfiles.profile })
    .from(t.conversations)
    .leftJoin(t.seekerProfiles, eq(t.seekerProfiles.email, t.conversations.seekerEmail))
    .where(eq(t.conversations.employerId, employerId));
  return new Map(
    rows.map(({ conversation: c, page }) => [
      seekerJobKey(c.seekerEmail, c.jobId ?? ""),
      (page?.name?.trim() || c.seekerName || "").slice(0, NAME_MAX),
    ]),
  );
}

/** An email has no spaces. */
export const seekerJobKey = (seekerEmail: string, jobId: string) => `${normalizeEmail(seekerEmail)} ${jobId}`;

/** The reader's conversation an id from the browser names (see parseSharedId); undefined when it is not theirs. */
export async function findSharedConversation(
  reader: SharedReader,
  key: { employerId: string; jobId: string } | { rowId: string },
): Promise<ConversationRow | undefined> {
  const db = await database();
  if (reader.side === "seeker" && "employerId" in key) {
    const [row] = await db
      .select()
      .from(t.conversations)
      .where(
        and(
          eq(t.conversations.seekerEmail, normalizeEmail(reader.email)),
          eq(t.conversations.employerId, key.employerId),
          eq(t.conversations.jobId, key.jobId),
        ),
      );
    return row;
  }
  if (reader.side === "employer" && "rowId" in key) {
    const [row] = await db.select().from(t.conversations).where(eq(t.conversations.id, key.rowId));
    return row?.employerId === reader.employerId ? row : undefined;
  }
  return undefined;
}

/**
 * The conversation of this job seeker and business about the job, made the first time either side starts it. The
 * caller has checked the job is open and the business may chat. `seekerName` is kept for the business until the job
 * seeker has a page on their account.
 */
export async function openSharedConversation(input: {
  seekerEmail: string;
  employerId: string;
  jobId: string;
  startedBy: Side;
  seekerName?: string;
  now?: Date;
}): Promise<ConversationRow> {
  const db = await database();
  const seekerEmail = normalizeEmail(input.seekerEmail);
  const at = (input.now ?? new Date()).toISOString();
  const name = input.seekerName?.trim().slice(0, NAME_MAX) || null;
  await db
    .insert(t.conversations)
    .values({
      id: randomUUID(),
      seekerEmail,
      employerId: input.employerId,
      jobId: input.jobId,
      startedBy: input.startedBy,
      seekerName: name,
      createdAt: at,
      updatedAt: at,
    })
    .onConflictDoNothing({ target: [t.conversations.seekerEmail, t.conversations.employerId, t.conversations.jobId] });
  const [row] = await db
    .select()
    .from(t.conversations)
    .where(
      and(
        eq(t.conversations.seekerEmail, seekerEmail),
        eq(t.conversations.employerId, input.employerId),
        eq(t.conversations.jobId, input.jobId),
      ),
    );
  if (name && !row.seekerName) {
    await db.update(t.conversations).set({ seekerName: name }).where(eq(t.conversations.id, row.id));
    return { ...row, seekerName: name };
  }
  return row;
}

const readColumn = (side: Side) => (side === "seeker" ? "seekerReadAt" : "employerReadAt");

/** The side has read the conversation up to now. */
export async function markSharedRead(conversationId: string, side: Side, now = new Date()): Promise<void> {
  const db = await database();
  await db
    .update(t.conversations)
    .set({ [readColumn(side)]: now.toISOString() })
    .where(eq(t.conversations.id, conversationId));
}

/**
 * A message from one side; whoever sends has read everything before it. The first one makes the job seeker one of the
 * job's candidates (ADR 0030).
 */
export async function addSharedMessage(
  conversationId: string,
  side: Side,
  text: string,
  byName: string | undefined,
  now = new Date(),
): Promise<void> {
  const db = await database();
  const at = now.toISOString();
  await db.transaction(async (tx) => {
    await tx.insert(t.messages).values({ conversationId, from: side, text, sentAt: at, byName: byName ?? null });
    const [conversation] = await tx.select().from(t.conversations).where(eq(t.conversations.id, conversationId));
    if (conversation) await addChatCandidate(tx, conversation, at);
    await tx
      .update(t.conversations)
      .set({ updatedAt: at, [readColumn(side)]: at })
      .where(eq(t.conversations.id, conversationId));
  });
}

export async function addSharedExchange(
  conversationId: string,
  item: { id: string; kind: ExchangeKind; requestedBy: Side; offered: ExchangePayload; createdAt: string },
): Promise<void> {
  const db = await database();
  await db.transaction(async (tx) => {
    await tx.insert(t.exchanges).values({ ...item, conversationId, status: "pending" });
    await tx.update(t.conversations).set({ updatedAt: item.createdAt }).where(eq(t.conversations.id, conversationId));
  });
}

/** Writes an answer only to an exchange still pending, so two answers at once cannot both count. */
export async function answerSharedExchange(
  conversationId: string,
  exchangeId: string,
  answer: { status: SharedExchange["status"]; response?: ExchangePayload; respondedAt: string },
): Promise<void> {
  const db = await database();
  await db.transaction(async (tx) => {
    const answered = await tx
      .update(t.exchanges)
      .set({ status: answer.status, response: answer.response ?? null, respondedAt: answer.respondedAt })
      .where(
        and(
          eq(t.exchanges.id, exchangeId),
          eq(t.exchanges.conversationId, conversationId),
          eq(t.exchanges.status, "pending"),
        ),
      )
      .returning({ id: t.exchanges.id });
    if (!answered.length) return;
    await tx
      .update(t.conversations)
      .set({ updatedAt: answer.respondedAt })
      .where(eq(t.conversations.id, conversationId));
  });
}
