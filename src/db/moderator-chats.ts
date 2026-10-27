// 审核员和雇主聊天 (#407, ADR 0046): a business's one conversation with the moderators. A moderator opens it; the
// business's team reads and writes it, banned or not. The business sees 找工审核员, never which moderator; each message
// keeps whose account sent it, for the moderators and the moderation record. Server only.
import { and, asc, count, desc, eq, gt, inArray, max, sql } from "drizzle-orm";
import { database } from "@/db/ready";
import { guardedBatch } from "@/db/guarded-batch";
import { insertIf } from "@/db/write-if";
import * as t from "@/db/schema";
import type { ModeratorChatSide } from "@/lib/moderator-chat";

export type ModeratorChatOrigin = "report" | "verification" | "temp_ban";
export const MODERATOR_CHAT_ORIGINS: readonly ModeratorChatOrigin[] = ["report", "verification", "temp_ban"];

/** The most messages one conversation keeps taking, as a job seeker's chat (SHARED_MESSAGES_MAX). */
export const MODERATOR_CHAT_MESSAGES_MAX = 500;

export interface ModeratorChatMessage {
  id: number;
  from: ModeratorChatSide;
  /** Whose account sent it; "deleted-account" once deleted. Never handed to the business. */
  senderEmail: string;
  /** The team member's name for the business's messages, as it was when sent. */
  byName: string | null;
  text: string;
  sentAt: string;
}

export type ModeratorChat = typeof t.moderatorChats.$inferSelect;

/** A conversation as the moderators' list shows it. */
export interface ModeratorChatSummary {
  employerId: string;
  employerName: string;
  openedAt: string;
  updatedAt: string;
  last?: { from: ModeratorChatSide; text: string; sentAt: string };
  /** The business's messages no moderator has read. */
  unread: number;
}

/**
 * Opens the business's conversation with the moderators, or keeps the one it has. False when the business does not
 * exist.
 */
export async function openModeratorChat(
  employerId: string,
  moderator: string,
  from: ModeratorChatOrigin,
  now = new Date(),
): Promise<boolean> {
  const db = await database();
  const [employer] = await db.select({ id: t.employers.id }).from(t.employers).where(eq(t.employers.id, employerId));
  if (!employer) return false;
  const at = now.toISOString();
  await db
    .insert(t.moderatorChats)
    .values({ employerId, openedBy: moderator, openedFrom: from, openedAt: at, updatedAt: at })
    .onConflictDoNothing();
  return true;
}

export async function getModeratorChat(employerId: string): Promise<ModeratorChat | undefined> {
  const db = await database();
  const [row] = await db.select().from(t.moderatorChats).where(eq(t.moderatorChats.employerId, employerId));
  return row;
}

/** The conversation's messages, oldest first. */
export async function moderatorChatMessages(employerId: string): Promise<ModeratorChatMessage[]> {
  const db = await database();
  return db
    .select({
      id: t.moderatorChatMessages.id,
      from: t.moderatorChatMessages.from,
      senderEmail: t.moderatorChatMessages.senderEmail,
      byName: t.moderatorChatMessages.byName,
      text: t.moderatorChatMessages.text,
      sentAt: t.moderatorChatMessages.sentAt,
    })
    .from(t.moderatorChatMessages)
    .where(eq(t.moderatorChatMessages.employerId, employerId))
    .orderBy(asc(t.moderatorChatMessages.id));
}

const readColumn = (side: ModeratorChatSide) => (side === "moderator" ? "moderatorsReadAt" : "employerReadAt");

/**
 * A message from one side into a conversation that is open; whoever sends has read everything before it. Only while
 * it has fewer than MODERATOR_CHAT_MESSAGES_MAX messages, checked in the statement that writes. Whether it was added.
 */
export async function addModeratorChatMessage(
  message: { employerId: string; from: ModeratorChatSide; senderEmail: string; byName?: string | null; text: string },
  now = new Date(),
): Promise<boolean> {
  const db = await database();
  const at = now.toISOString();
  const { employerId } = message;
  const { applied } = await guardedBatch(
    db,
    sql`exists (select 1 from ${t.moderatorChats} where ${t.moderatorChats.employerId} = ${employerId})
      and (${db.select({ n: count() }).from(t.moderatorChatMessages).where(eq(t.moderatorChatMessages.employerId, employerId))}) < ${MODERATOR_CHAT_MESSAGES_MAX}`,
    (allowed) => [
      insertIf(
        db,
        t.moderatorChatMessages,
        {
          employerId,
          from: message.from,
          senderEmail: message.senderEmail,
          byName: message.from === "employer" ? (message.byName ?? null) : null,
          text: message.text,
          sentAt: at,
        },
        allowed,
      ),
      db
        .update(t.moderatorChats)
        .set({ updatedAt: at, [readColumn(message.from)]: at })
        .where(and(eq(t.moderatorChats.employerId, employerId), allowed)),
    ],
  );
  return applied;
}

/** One side has read the conversation up to now. */
export async function markModeratorChatRead(employerId: string, side: ModeratorChatSide, now = new Date()) {
  const db = await database();
  await db
    .update(t.moderatorChats)
    .set({ [readColumn(side)]: now.toISOString() })
    .where(eq(t.moderatorChats.employerId, employerId));
}

/** Every conversation, the newest message first: the business's name, its last message and what waits unread. */
export async function listModeratorChats(): Promise<ModeratorChatSummary[]> {
  const db = await database();
  const chats = await db
    .select({ chat: t.moderatorChats, name: t.employers.name })
    .from(t.moderatorChats)
    .innerJoin(t.employers, eq(t.employers.id, t.moderatorChats.employerId))
    .orderBy(desc(t.moderatorChats.updatedAt));
  if (!chats.length) return [];
  const ids = chats.map((row) => row.chat.employerId);
  const lastIds = db
    .select({ id: max(t.moderatorChatMessages.id) })
    .from(t.moderatorChatMessages)
    .where(inArray(t.moderatorChatMessages.employerId, ids))
    .groupBy(t.moderatorChatMessages.employerId);
  const [lasts, unread] = await Promise.all([
    db.select().from(t.moderatorChatMessages).where(inArray(t.moderatorChatMessages.id, lastIds)),
    db
      .select({ employerId: t.moderatorChatMessages.employerId, n: count() })
      .from(t.moderatorChatMessages)
      .innerJoin(t.moderatorChats, eq(t.moderatorChats.employerId, t.moderatorChatMessages.employerId))
      .where(
        and(
          inArray(t.moderatorChatMessages.employerId, ids),
          eq(t.moderatorChatMessages.from, "employer"),
          gt(t.moderatorChatMessages.sentAt, sql`coalesce(${t.moderatorChats.moderatorsReadAt}, '')`),
        ),
      )
      .groupBy(t.moderatorChatMessages.employerId),
  ]);
  return chats.map(({ chat, name }) => {
    const last = lasts.find((m) => m.employerId === chat.employerId);
    return {
      employerId: chat.employerId,
      employerName: name,
      openedAt: chat.openedAt,
      updatedAt: chat.updatedAt,
      ...(last ? { last: { from: last.from, text: last.text, sentAt: last.sentAt } } : {}),
      unread: unread.find((row) => row.employerId === chat.employerId)?.n ?? 0,
    };
  });
}
