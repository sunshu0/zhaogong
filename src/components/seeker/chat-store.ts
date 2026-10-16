// Chat data kept in the browser. Only what happened since the demo is stored per identity: messages added after
// the demo thread (the user's own, or a reply another tab simulates), when the user read each conversation, conversations they opened, exchanges they started or answered, and reports. The demo
// conversations are merged in when the chat is read (chatView), so a change to the demo data never wipes a
// user's own records. Stored under LOCAL_DATA_VERSION; data from before versioning is migrated on read.
import { parseStoredIdentities, scopeRole } from "@/components/seeker/identity-scope";
import { validTimestamp } from "@/lib/chat-activity";
import {
  parseExchange,
  requestExchange,
  respondExchange,
  type Exchange,
  type ExchangeKind,
  type ExchangePayload,
} from "@/lib/chat-consent";
import { parseChatReport, type ChatReport } from "@/lib/chat-report";

export type Message = {
  from: "me" | "them";
  text: string;
  time: string;
  sentAt?: string;
  readAt?: string;
  /**
   * Who in a business's team sent a message of the business side (#87): the name they go by, as it was when sent.
   * Kept for the shared conversations of #110, where the job seeker sees 「店名 · 名字」.
   */
  by?: string;
};

export type Conversation = {
  id: string;
  person: string;
  title: string;
  time: string;
  avatar: string;
  job: string | null;
  employerId?: string;
  candidateId?: string;
};

export type ChatDemo = {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  unread: Record<string, number>;
  exchanges: Record<string, Exchange[]>;
};

/** One identity's own chat records. */
export type ChatRecord = {
  /** Messages added after the demo thread, per conversation (the user's own, oldest first). */
  added: Record<string, Message[]>;
  /** When the user last read each conversation. */
  readAt: Record<string, string>;
  /** Conversations the user opened (from a job or a recommended candidate), newest first. */
  extra: Conversation[];
  /** Exchanges the user started, or demo ones they answered (same id replaces the demo one). */
  exchanges: Record<string, Exchange[]>;
  reports: ChatReport[];
};

export const EMPTY_CHAT: ChatRecord = { added: {}, readAt: {}, extra: [], exchanges: {}, reports: [] };

/** Used when old data says a conversation was read but not when. */
export const LEGACY_READ_AT = "2026-10-14T00:00:00.000Z";

/** What the chat pages show: the demo merged with the user's own records. */
export type ChatView = {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  unread: Record<string, number>;
  exchanges: Record<string, Exchange[]>;
  reports: ChatReport[];
};

export function chatView(record: ChatRecord, demo: ChatDemo): ChatView {
  const conversations = [...record.extra, ...demo.conversations];
  const messages: Record<string, Message[]> = {};
  const unread: Record<string, number> = {};
  const exchanges: Record<string, Exchange[]> = {};
  for (const { id } of conversations) {
    const readAt = record.readAt[id];
    // A reply counts as read when the conversation was read after it arrived.
    const read = (m: Message) =>
      m.from === "them" && !m.readAt && readAt && !(m.sentAt && m.sentAt > readAt) ? { ...m, readAt } : m;
    const added = (record.added[id] ?? []).map(read);
    messages[id] = [...(demo.messages[id] ?? []).map(read), ...added];
    unread[id] = (readAt ? 0 : (demo.unread[id] ?? 0)) + added.filter((m) => m.from === "them" && !m.readAt).length;
    exchanges[id] = mergeExchanges(demo.exchanges[id] ?? [], record.exchanges[id] ?? []);
  }
  return { conversations, messages, unread, exchanges, reports: record.reports };
}

function mergeExchanges(demo: Exchange[], own: Exchange[]): Exchange[] {
  const byId = new Map(own.map((item) => [item.id, item]));
  return [
    ...demo.map((item) => byId.get(item.id) ?? item),
    ...own.filter((item) => !demo.some((d) => d.id === item.id)),
  ];
}

function upsert(items: Exchange[], item: Exchange): Exchange[] {
  return items.some((x) => x.id === item.id) ? items.map((x) => (x.id === item.id ? item : x)) : [...items, item];
}

export function markConversationRead(record: ChatRecord, id: string, now: string): ChatRecord {
  return { ...record, readAt: { ...record.readAt, [id]: now } };
}

export function addSentMessage(record: ChatRecord, id: string, text: string, now: string, by?: string): ChatRecord {
  const message: Message = { from: "me", text, time: "刚刚", sentAt: now, ...(by ? { by } : {}) };
  return { ...record, added: { ...record.added, [id]: [...(record.added[id] ?? []), message] } };
}

export function addExchangeRequest(
  record: ChatRecord,
  demo: ChatDemo,
  id: string,
  kind: ExchangeKind,
  payload: ExchangePayload,
  exchangeId: string,
): ChatRecord {
  const current = chatView(record, demo).exchanges[id] ?? [];
  const next = requestExchange(current, kind, payload, exchangeId);
  if (next === current) return record;
  const created = next[next.length - 1];
  return { ...record, exchanges: { ...record.exchanges, [id]: [...(record.exchanges[id] ?? []), created] } };
}

export function answerExchange(
  record: ChatRecord,
  demo: ChatDemo,
  id: string,
  exchangeId: string,
  status: "accepted" | "rejected" | "cancelled",
  payload?: ExchangePayload,
): ChatRecord {
  const item = chatView(record, demo).exchanges[id]?.find((x) => x.id === exchangeId);
  if (!item) return record;
  const answered = respondExchange(item, "me", status, payload);
  if (answered === item) return record;
  return { ...record, exchanges: { ...record.exchanges, [id]: upsert(record.exchanges[id] ?? [], answered) } };
}

export function addReport(record: ChatRecord, report: ChatReport): ChatRecord {
  return { ...record, reports: [...record.reports, report] };
}

export function openConversation(record: ChatRecord, conversation: Conversation): ChatRecord {
  if (record.extra.some((item) => item.id === conversation.id)) return record;
  return { ...record, extra: [conversation, ...record.extra] };
}

// ---- Reading what is stored ----

/**
 * Every stored identity's chat records. `demoFor` gives the demo an identity started with, which older data
 * needs to tell the user's own messages from the demo ones.
 */
export function parseChats(raw: string | null, demoFor: (isEmployer: boolean) => ChatDemo): Record<string, ChatRecord> {
  return parseStoredIdentities(raw, (value, { scope, legacy }) =>
    legacy ? migrateLegacyChat(value, demoFor(scopeRole(scope) === "employer")) : parseChatRecord(value),
  );
}

/** Each part is checked on its own: a bad message, exchange or report is dropped, not the whole record. */
export function parseChatRecord(value: unknown): ChatRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  return {
    added: mapOf(input.added, (list) => (Array.isArray(list) ? list.flatMap(parseMessage) : undefined)),
    readAt: mapOf(input.readAt, (at) => (validTimestamp(at) ? at : undefined)),
    extra: Array.isArray(input.extra) ? input.extra.flatMap(parseConversation) : [],
    exchanges: mapOf(input.exchanges, (list) => (Array.isArray(list) ? list.flatMap(parseExchanges) : undefined)),
    reports: Array.isArray(input.reports) ? input.reports.flatMap((r) => optional(parseChatReport(r))) : [],
  };
}

/**
 * Data from before versioning stored whole threads (demo and own messages together), unread counts and whole
 * exchange lists. Keep what the user did: messages after the demo thread (or, if the demo changed since, the
 * ones they sent), reads, opened conversations, exchanges that differ from the demo, and reports.
 */
export function migrateLegacyChat(value: unknown, demo: ChatDemo): ChatRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const threads = mapOf(input.messages, (list) => (Array.isArray(list) ? list.flatMap(parseMessage) : undefined));
  const unread = mapOf(input.unread, (n) => (Number.isInteger(n) && (n as number) >= 0 ? (n as number) : undefined));

  const added: Record<string, Message[]> = {};
  const readAt: Record<string, string> = {};
  for (const [id, thread] of Object.entries(threads)) {
    const start = demo.messages[id];
    const own = !start
      ? thread
      : start.every((m, i) => thread[i]?.from === m.from && thread[i]?.text === m.text)
        ? thread.slice(start.length)
        : thread.filter((m) => m.from === "me" && (m.sentAt || m.time === "刚刚"));
    if (own.length) added[id] = own;
    const reads = thread.flatMap((m) => (m.from === "them" && m.readAt ? [m.readAt] : [])).sort();
    const lastRead = reads[reads.length - 1];
    if (lastRead) readAt[id] = lastRead;
    else if (start && (demo.unread[id] ?? 0) > 0 && unread[id] === 0) readAt[id] = LEGACY_READ_AT;
  }

  const extra = Array.isArray(input.extra) ? input.extra.flatMap(parseConversation) : [];
  const exchanges = Object.fromEntries(
    Object.entries(
      mapOf(input.exchanges, (list) => (Array.isArray(list) ? list.flatMap(parseExchanges) : undefined)),
    ).flatMap(([id, list]) => {
      const changed = list.filter(
        (item) => JSON.stringify(item) !== JSON.stringify(demo.exchanges[id]?.find((d) => d.id === item.id)),
      );
      return changed.length ? [[id, changed]] : [];
    }),
  );
  const reports = Array.isArray(input.reports) ? input.reports.flatMap((r) => optional(parseChatReport(r))) : [];
  return { added, readAt, extra, exchanges, reports };
}

function parseMessage(value: unknown): Message[] {
  if (!value || typeof value !== "object") return [];
  const m = value as Record<string, unknown>;
  if ((m.from !== "me" && m.from !== "them") || typeof m.text !== "string" || typeof m.time !== "string") return [];
  return [
    {
      from: m.from,
      text: m.text,
      time: m.time,
      ...(validTimestamp(m.sentAt) ? { sentAt: m.sentAt } : {}),
      ...(validTimestamp(m.readAt) ? { readAt: m.readAt } : {}),
      ...(typeof m.by === "string" && m.by.length <= 40 ? { by: m.by } : {}),
    },
  ];
}

function parseConversation(value: unknown): Conversation[] {
  if (!value || typeof value !== "object") return [];
  const c = value as Record<string, unknown>;
  const { id, person, title, time, avatar, job, employerId, candidateId } = c;
  if (
    typeof id !== "string" ||
    !["recommend:", "employer:", "apply:", "chat:"].some((prefix) => id.startsWith(prefix)) ||
    ![person, title, time, avatar, job].every((field) => typeof field === "string") ||
    (employerId !== undefined && typeof employerId !== "string") ||
    (candidateId !== undefined && typeof candidateId !== "string")
  )
    return [];
  return [
    {
      id,
      person: person as string,
      title: title as string,
      time: time as string,
      avatar: avatar as string,
      job: job as string,
      ...(employerId !== undefined ? { employerId } : {}),
      ...(candidateId !== undefined ? { candidateId } : {}),
    },
  ];
}

function parseExchanges(value: unknown): Exchange[] {
  return optional(parseExchange(value));
}

function optional<T>(value: T | undefined): T[] {
  return value === undefined ? [] : [value];
}

function mapOf<T>(value: unknown, parse: (entry: unknown) => T | undefined): Record<string, T> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) => {
      const parsed = parse(entry);
      return parsed === undefined ? [] : [[key, parsed]];
    }),
  );
}
