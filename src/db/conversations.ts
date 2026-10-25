// The conversations a job seeker and a business share (#110, ADR 0015): one per job seeker account, business and job,
// with its messages and exchanges. Both sides read and write the same rows; src/lib/chat-server/shared-view.ts turns
// them into what each side sees. Server only.
import { randomUUID } from "node:crypto";
import { and, asc, count, eq, gt, lte, max, sql, type SQL } from "drizzle-orm";
import { guardedBatch } from "@/db/guarded-batch";
import { inList } from "@/db/in-list";
import { insertIf } from "@/db/write-if";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { chatCandidateInsert } from "@/db/job-applications";
import { normalizeEmail } from "@/components/seeker/session";
import type { SharedConversation, SharedExchange, Side } from "@/lib/chat-server/shared-view";
import type { ExchangeKind, ExchangePayload } from "@/lib/chat-consent";
import type { ResumeDoc } from "@/components/seeker/resume-doc";

export type ConversationRow = typeof t.conversations.$inferSelect;

/** Whose conversations: a job seeker account's, or a business's (everyone in its team). */
export type SharedReader = { side: "seeker"; email: string } | { side: "employer"; employerId: string };

const NAME_MAX = 40;

/**
 * Messages one shared conversation holds, both sides and the whole team together (review of security review F): about
 * one job, so a few hundred is weeks of daily talk, and a full read sends the whole thread, so it must stay bounded.
 * (The chat page's read every 10 seconds sends only what changed, #369, ADR 0040.) A message past it is not added;
 * the sender is told.
 */
export const SHARED_MESSAGES_MAX = 500;

const ofReader = (reader: SharedReader) =>
  reader.side === "seeker"
    ? eq(t.conversations.seekerEmail, normalizeEmail(reader.email))
    : eq(t.conversations.employerId, reader.employerId);

/**
 * The id of the newest message of anyone's (0 when there is none). Read before the conversations, it is where a read
 * stops: a message written meanwhile has a higher id, so the next read since it gets it (ADR 0040).
 */
export async function newestMessageId(): Promise<number> {
  const db = await database();
  const [row] = await db.select({ id: max(t.messages.id) }).from(t.messages);
  return row?.id ?? 0;
}

/**
 * The reader's conversations with their messages and exchanges, oldest message first. With `upTo`, only the messages
 * up to that id (newestMessageId, read first).
 */
export async function listSharedConversations(reader: SharedReader, upTo?: number): Promise<SharedConversation[]> {
  return readShared(ofReader(reader), upTo === undefined ? undefined : { after: 0, upTo });
}

/** One of the reader's conversations as the list of them gives it, without its messages and exchanges. */
export type SharedHead = Pick<SharedConversation, "id" | "employerId" | "jobId" | "updatedAt">;

/**
 * What changed in the reader's conversations since a read (#369, ADR 0040): every conversation's head, for the order
 * of the list and to tell which are gone; and the conversations with a message after `messageId` (up to `upTo`), or
 * read by either side or written to after `at`, each with those new messages only and all its exchanges.
 */
export async function listSharedChanges(
  reader: SharedReader,
  since: { messageId: number; at: string },
  upTo: number,
): Promise<{ heads: SharedHead[]; changed: SharedConversation[] }> {
  const db = await database();
  // The same conversations the full list has (its joins), without the job seeker's page.
  const heads = (
    await db
      .select({ conversation: t.conversations })
      .from(t.conversations)
      .innerJoin(t.employers, eq(t.employers.id, t.conversations.employerId))
      .innerJoin(t.jobs, eq(t.jobs.id, t.conversations.jobId))
      .where(ofReader(reader))
  ).map((r) => r.conversation);
  if (!heads.length) return { heads: [], changed: [] };
  // The newest messages only: the id range keeps this to them, whatever the conversations hold.
  const written = await db
    .selectDistinct({ id: t.messages.conversationId })
    .from(t.messages)
    .where(
      and(
        inList(
          t.messages.conversationId,
          heads.map((h) => h.id),
        ),
        gt(t.messages.id, since.messageId),
        lte(t.messages.id, upTo),
      ),
    );
  const withNew = new Set(written.map((m) => m.id));
  const changed = heads
    .filter(
      (h) =>
        withNew.has(h.id) || [h.updatedAt, h.seekerReadAt, h.employerReadAt].some((at) => at !== null && at > since.at),
    )
    .map((h) => h.id);
  return {
    heads: heads.map((h) => ({
      id: h.id,
      employerId: h.employerId,
      jobId: h.jobId!,
      updatedAt: h.updatedAt ?? h.createdAt,
    })),
    changed: changed.length
      ? await readShared(inList(t.conversations.id, changed), { after: since.messageId, upTo })
      : [],
  };
}

/** The conversations `where` picks, with their messages (those in the id range, all without one) and exchanges. */
async function readShared(where: SQL, range?: { after: number; upTo: number }): Promise<SharedConversation[]> {
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
    .where(where);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.conversation.id);
  const messages = await db
    .select()
    .from(t.messages)
    .where(
      and(
        inList(t.messages.conversationId, ids),
        range ? and(gt(t.messages.id, range.after), lte(t.messages.id, range.upTo)) : undefined,
      ),
    )
    .orderBy(asc(t.messages.id));
  const exchanges = await db
    .select()
    .from(t.exchanges)
    .where(inList(t.exchanges.conversationId, ids))
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
        .map((m) => ({
          id: m.id,
          from: m.from,
          text: m.text,
          sentAt: m.sentAt,
          byName: m.byName,
          ...(m.resume ? { resume: m.resume } : {}),
        })),
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
 * A 中英文简历 sent in one of the reader's conversations (#379, ADR 0037): the page as sent, when, and the business it
 * went to; undefined when the message is not one, or not in a conversation of theirs.
 */
export async function resumeInChat(
  reader: SharedReader,
  messageId: number,
): Promise<{ resume: ResumeDoc; sentAt: string; employerName: string } | undefined> {
  if (!Number.isSafeInteger(messageId) || messageId < 1) return undefined;
  const db = await database();
  const [row] = await db
    .select({ message: t.messages, conversation: t.conversations, employerName: t.employers.name })
    .from(t.messages)
    .innerJoin(t.conversations, eq(t.conversations.id, t.messages.conversationId))
    .innerJoin(t.employers, eq(t.employers.id, t.conversations.employerId))
    .where(eq(t.messages.id, messageId));
  if (!row?.message.resume) return undefined;
  const theirs =
    reader.side === "seeker"
      ? row.conversation.seekerEmail === normalizeEmail(reader.email)
      : row.conversation.employerId === reader.employerId;
  return theirs
    ? { resume: row.message.resume, sentAt: row.message.sentAt, employerName: row.employerName }
    : undefined;
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
 * job's candidates (ADR 0030). Only while the conversation has fewer than SHARED_MESSAGES_MAX messages, checked in
 * the statement that writes, so messages sent at once cannot pass it together; whether it was added.
 */
export async function addSharedMessage(
  conversationId: string,
  side: Side,
  text: string,
  byName: string | undefined,
  now = new Date(),
  resume?: ResumeDoc,
): Promise<boolean> {
  const db = await database();
  const at = now.toISOString();
  const row = { conversationId, from: side, text, sentAt: at, byName: byName ?? null, resume: resume ?? null };
  const { applied } = await guardedBatch(
    db,
    sql`(${db.select({ n: count() }).from(t.messages).where(eq(t.messages.conversationId, conversationId))}) < ${SHARED_MESSAGES_MAX}`,
    (allowed) => [
      insertIf(db, t.messages, row, allowed),
      chatCandidateInsert(db, conversationId, at, allowed),
      db
        .update(t.conversations)
        .set({ updatedAt: at, [readColumn(side)]: at })
        .where(and(eq(t.conversations.id, conversationId), allowed)),
    ],
  );
  return applied;
}

/**
 * A new request, and the closed ones of the conversation it leaves out (#366, requestExchange): only requests turned
 * down or withdrawn are taken out, in the same batch.
 */
export async function addSharedExchange(
  conversationId: string,
  item: { id: string; kind: ExchangeKind; requestedBy: Side; offered: ExchangePayload; createdAt: string },
  dropped: string[] = [],
): Promise<void> {
  const db = await database();
  await db.batch([
    db
      .delete(t.exchanges)
      .where(
        and(
          eq(t.exchanges.conversationId, conversationId),
          inList(t.exchanges.id, dropped),
          inList(t.exchanges.status, ["rejected", "cancelled"]),
        ),
      ),
    db.insert(t.exchanges).values({ ...item, conversationId, status: "pending" }),
    db.update(t.conversations).set({ updatedAt: item.createdAt }).where(eq(t.conversations.id, conversationId)),
  ]);
}

/** Writes an answer only to an exchange still pending, so two answers at once cannot both count. */
export async function answerSharedExchange(
  conversationId: string,
  exchangeId: string,
  answer: { status: SharedExchange["status"]; response?: ExchangePayload; respondedAt: string },
): Promise<void> {
  const db = await database();
  await guardedBatch(
    db,
    sql`exists (
    select 1 from ${t.exchanges} where ${t.exchanges.id} = ${exchangeId}
    and ${t.exchanges.conversationId} = ${conversationId} and ${t.exchanges.status} = 'pending'
  )`,
    (allowed) => [
      db
        .update(t.exchanges)
        .set({ status: answer.status, response: answer.response ?? null, respondedAt: answer.respondedAt })
        .where(and(eq(t.exchanges.id, exchangeId), allowed)),
      db
        .update(t.conversations)
        .set({ updatedAt: answer.respondedAt })
        .where(and(eq(t.conversations.id, conversationId), allowed)),
    ],
  );
}
