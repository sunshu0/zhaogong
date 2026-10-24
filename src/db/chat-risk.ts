// 聊天风险 (#384, ADR 0039): the records of a business's chat messages that hit the chat rules, and the items they open
// for moderators. Only the business's side is recorded (messages/actions.ts). No scheduled job (ADR 0008): the first
// record of a New Zealand day deletes those older than CHAT_RISK_KEEP_DAYS. Server only.
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";
import { database } from "@/db/ready";
import { inList } from "@/db/in-list";
import { nzDay } from "@/db/job-stats";
import * as t from "@/db/schema";
import { CHAT_RISK_WINDOW_DAYS, keptFrom, opensItem, type ChatRiskRule } from "@/lib/chat-risk";
import { CHAT_RULES } from "@/lib/compliance/check";

/** An open item as the moderators' list shows it: never the messages, only how many and which kinds. */
export interface ChatRiskItem {
  employerId: string;
  employerName: string;
  rules: ChatRiskRule[];
  count: number;
  lastAt: string;
  openedAt: string;
}

/** One message of an item, for a moderator who opens it (recorded as a view of the chat, ADR 0026). */
export interface ChatRiskMessage {
  conversationId: string;
  messageId: number;
  rules: ChatRiskRule[];
  text: string;
  /** Who in the business's team sent it (ADR 0012). */
  byName: string | null;
  sentAt: string;
}

/** The most messages one item hands over, newest first. */
export const ITEM_MESSAGES_MAX = 50;

let cleanedDay: string | undefined;

/** Records older than CHAT_RISK_KEEP_DAYS, once per New Zealand day. */
async function cleanUp(now: Date): Promise<void> {
  const day = nzDay(now);
  if (cleanedDay === day) return;
  cleanedDay = day;
  const db = await database();
  await db.delete(t.chatRiskHits).where(lt(t.chatRiskHits.at, keptFrom(now)));
}

/**
 * Records that the business's message sent at `sentAt` in this chat hit `rules`, and opens the business's item when
 * that makes enough (lib/chat-risk.ts). Call it after the message is written; nothing when it is not there.
 */
export async function recordChatRisk(
  hit: { employerId: string; conversationId: string; sentAt: string; rules: readonly ChatRiskRule[] },
  now = new Date(),
): Promise<void> {
  const rules = CHAT_RULES.filter((rule) => hit.rules.includes(rule));
  if (!rules.length) return;
  await cleanUp(now);
  const db = await database();
  const [message] = await db
    .select({ id: t.messages.id })
    .from(t.messages)
    .where(
      and(
        eq(t.messages.conversationId, hit.conversationId),
        eq(t.messages.from, "employer"),
        eq(t.messages.sentAt, hit.sentAt),
      ),
    )
    .orderBy(desc(t.messages.id))
    .limit(1);
  if (!message) return;
  const at = now.toISOString();
  await db.insert(t.chatRiskHits).values({
    employerId: hit.employerId,
    conversationId: hit.conversationId,
    messageId: message.id,
    rules,
    at,
  });
  const [flag] = await db.select().from(t.chatRiskFlags).where(eq(t.chatRiskFlags.employerId, hit.employerId));
  if (flag?.status === "open") return;
  const windowStart = new Date(now.getTime() - CHAT_RISK_WINDOW_DAYS * 86_400_000).toISOString();
  const recent = await db
    .select({ at: t.chatRiskHits.at })
    .from(t.chatRiskHits)
    .where(and(eq(t.chatRiskHits.employerId, hit.employerId), gt(t.chatRiskHits.at, windowStart)));
  const since = flag?.closedAt ?? null;
  if (
    !opensItem(
      recent.map((r) => r.at),
      since,
      now,
    )
  )
    return;
  // Two messages at once may both get here: the row is the same either way, and an open one is left as it is.
  await db
    .insert(t.chatRiskFlags)
    .values({ employerId: hit.employerId, status: "open", since, openedAt: at })
    .onConflictDoUpdate({
      target: t.chatRiskFlags.employerId,
      set: { status: "open", since, openedAt: at, closedAt: null },
      setWhere: eq(t.chatRiskFlags.status, "closed"),
    });
}

/** The records an open item covers: after the item before was closed, still kept. */
function covered(flag: { employerId: string; since: string | null }) {
  return and(
    eq(t.chatRiskHits.employerId, flag.employerId),
    flag.since ? gt(t.chatRiskHits.at, flag.since) : undefined,
  );
}

/** The open items, the one with the newest message first. Items whose records have all been deleted are left out. */
export async function listChatRiskItems(): Promise<ChatRiskItem[]> {
  const db = await database();
  const flags = await db.select().from(t.chatRiskFlags).where(eq(t.chatRiskFlags.status, "open"));
  if (!flags.length) return [];
  const ids = flags.map((f) => f.employerId);
  const hits = await db
    .select({ employerId: t.chatRiskHits.employerId, rules: t.chatRiskHits.rules, at: t.chatRiskHits.at })
    .from(t.chatRiskHits)
    .where(inList(t.chatRiskHits.employerId, ids))
    .orderBy(asc(t.chatRiskHits.at));
  const names = new Map(
    (
      await db
        .select({ id: t.employers.id, name: t.employers.name })
        .from(t.employers)
        .where(inList(t.employers.id, ids))
    ).map((e) => [e.id, e.name]),
  );
  const items: ChatRiskItem[] = [];
  for (const flag of flags) {
    const mine = hits.filter((h) => h.employerId === flag.employerId && (!flag.since || h.at > flag.since));
    if (!mine.length) continue;
    const seen = new Set(mine.flatMap((h) => h.rules));
    items.push({
      employerId: flag.employerId,
      employerName: names.get(flag.employerId) ?? flag.employerId,
      rules: CHAT_RULES.filter((rule) => seen.has(rule)),
      count: mine.length,
      lastAt: mine[mine.length - 1].at,
      openedAt: flag.openedAt,
    });
  }
  return items.sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
}

/** The messages an open item covers, newest first, at most ITEM_MESSAGES_MAX; empty when no item is open. */
export async function chatRiskMessages(employerId: string): Promise<ChatRiskMessage[]> {
  const db = await database();
  const [flag] = await db
    .select()
    .from(t.chatRiskFlags)
    .where(and(eq(t.chatRiskFlags.employerId, employerId), eq(t.chatRiskFlags.status, "open")));
  if (!flag) return [];
  return db
    .select({
      conversationId: t.chatRiskHits.conversationId,
      messageId: t.chatRiskHits.messageId,
      rules: t.chatRiskHits.rules,
      text: t.messages.text,
      byName: t.messages.byName,
      sentAt: t.messages.sentAt,
    })
    .from(t.chatRiskHits)
    .innerJoin(t.messages, eq(t.messages.id, t.chatRiskHits.messageId))
    .where(covered(flag))
    .orderBy(desc(t.chatRiskHits.at), desc(t.chatRiskHits.id))
    .limit(ITEM_MESSAGES_MAX);
}

/**
 * A moderator closes a business's open item; the rules its records hit, for the log, or undefined when none was open
 * (closed meanwhile by someone else).
 */
export async function closeChatRisk(
  employerId: string,
  now = new Date(),
): Promise<{ rules: ChatRiskRule[]; count: number } | undefined> {
  const db = await database();
  const [flag] = await db
    .select()
    .from(t.chatRiskFlags)
    .where(and(eq(t.chatRiskFlags.employerId, employerId), eq(t.chatRiskFlags.status, "open")));
  if (!flag) return undefined;
  const hits = await db.select({ rules: t.chatRiskHits.rules }).from(t.chatRiskHits).where(covered(flag));
  const closed = await db
    .update(t.chatRiskFlags)
    .set({ status: "closed", closedAt: now.toISOString() })
    .where(and(eq(t.chatRiskFlags.employerId, employerId), eq(t.chatRiskFlags.status, "open")))
    .returning({ employerId: t.chatRiskFlags.employerId });
  if (!closed.length) return undefined;
  const seen = new Set(hits.flatMap((h) => h.rules));
  return { rules: CHAT_RULES.filter((rule) => seen.has(rule)), count: hits.length };
}

/** For tests: the next record cleans again, as on a new day. */
export function resetChatRiskCleanupForTests(): void {
  cleanedDay = undefined;
}
