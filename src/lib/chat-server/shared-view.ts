// The conversations a job seeker and a business share (#110, ADR 0015), as each side sees them. The browser knows one
// shape, ChatRecord (chat-store.ts); the server turns the shared rows into that shape for the side reading, and merges
// them with the identity's own record (demo conversations, chats with demo candidates, reports, what came before
// #110). Pure: the rows come from src/db/conversations.ts.
import type { ChatRecord, Conversation, Message } from "@/components/seeker/chat-store";
import { visibleExchange, type Exchange, type ExchangeKind, type ExchangePayload } from "@/lib/chat-consent";
import type { AccountRole } from "@/lib/types";
import { contactKeys, type ResumeDoc } from "@/components/seeker/resume-doc";
import { formatDate } from "@/i18n/format";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { chatMessages } from "@/i18n/messages/chat";

export type Side = AccountRole;

export type SharedExchange = {
  id: string;
  kind: ExchangeKind;
  requestedBy: Side;
  status: Exchange["status"];
  offered: ExchangePayload;
  response: ExchangePayload | null;
  createdAt: string;
  respondedAt: string | null;
};

export type SharedConversation = {
  id: string;
  employerId: string;
  employerName: string;
  jobId: string;
  jobTitle: string;
  startedBy: Side;
  /** The job seeker's name as the business sees it: their page's, or the one they applied or were found with. */
  seekerName: string;
  /** Their 推荐人才 card (local-…), when they let businesses find them. */
  candidateId?: string;
  seekerReadAt: string | null;
  employerReadAt: string | null;
  updatedAt: string;
  /** `resume`: a 中英文简历 the job seeker sent (#379), the page as sent. */
  messages: { id: number; from: Side; text: string; sentAt: string; byName: string | null; resume?: ResumeDoc }[];
  exchanges: SharedExchange[];
};

/** What a shared conversation adds to the reading side's ChatRecord. */
export type SharedPart = Pick<ChatRecord, "added" | "readAt" | "exchanges"> & { conversations: Conversation[] };

const SEEKER_PREFIX = "employer:";
const EMPLOYER_PREFIX = "chat:";

/**
 * The conversation's id on each side. A job seeker has one conversation per job, so its id stays the one the browser
 * makes before the server answers (`employer:<business>:<job>`); the business sees `chat:<id>`.
 */
export function sharedConversationId(row: Pick<SharedConversation, "id" | "employerId" | "jobId">, side: Side): string {
  return side === "seeker" ? `${SEEKER_PREFIX}${row.employerId}:${row.jobId}` : `${EMPLOYER_PREFIX}${row.id}`;
}

/** Which shared conversation an id the browser sends names, for the side sending it; undefined when none. */
export function parseSharedId(
  id: unknown,
  side: Side,
): { employerId: string; jobId: string } | { rowId: string } | undefined {
  if (typeof id !== "string") return undefined;
  if (side === "seeker" && id.startsWith(SEEKER_PREFIX)) {
    const [employerId, jobId, ...rest] = id.slice(SEEKER_PREFIX.length).split(":");
    return employerId && jobId && !rest.length ? { employerId, jobId } : undefined;
  }
  if (side === "employer" && id.startsWith(EMPLOYER_PREFIX)) {
    const rowId = id.slice(EMPLOYER_PREFIX.length);
    return /^[A-Za-z0-9-]{8,64}$/.test(rowId) ? { rowId } : undefined;
  }
  return undefined;
}

// Never sent to the side that may not see it (R-12): an offer withdrawn or turned down, or an answer the asker did
// not get. Kept in shape, so the browser still shows that the exchange happened.
const withheld = (lang: Lang): ExchangePayload => ({
  title: pick(chatMessages, lang).times.withheld,
  fields: [{ label: "", value: "—" }],
});

function exchangeFor(item: SharedExchange, side: Side, lang: Lang): Exchange {
  const exchange: Exchange = {
    id: item.id,
    kind: item.kind,
    from: item.requestedBy === side ? "me" : "them",
    status: item.status,
    offered: item.offered,
    ...(item.response ? { response: item.response } : {}),
    createdAt: item.createdAt,
    ...(item.respondedAt ? { respondedAt: item.respondedAt } : {}),
  };
  const visible = visibleExchange(exchange);
  if (exchange.from === "them" && visible?.them !== exchange.offered) exchange.offered = withheld(lang);
  if (exchange.from === "me" && exchange.response && visible?.them !== exchange.response)
    exchange.response = withheld(lang);
  return exchange;
}

/** A short time for a message or a conversation row, in New Zealand time: 10:42, 昨天 or 10月15日 (Yesterday, 15 October). */
export function chatTime(at: string, now: number, lang: Lang = DEFAULT_LANG): string {
  const day = (ms: number) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland", dateStyle: "short" }).format(ms);
  const then = Date.parse(at);
  if (day(then) === day(now))
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Pacific/Auckland",
      hour: "2-digit",
      minute: "2-digit",
    }).format(then);
  if (day(then) === day(now - 86_400_000)) return pick(chatMessages, lang).times.yesterday;
  return formatDate(then, lang, { month: "long", day: "numeric" });
}

export function sharedPart(rows: SharedConversation[], side: Side, now: number, lang: Lang = DEFAULT_LANG): SharedPart {
  const part: SharedPart = { conversations: [], added: {}, readAt: {}, exchanges: {} };
  const newestFirst = [...rows].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const row of newestFirst) {
    // Opening a chat writes nothing to the other side until something is said in it.
    if (quiet(row, side)) continue;
    addRow(part, row, side, now, lang);
  }
  return part;
}

/** A chat the other side opened in which nothing is said (as far as the row's messages and exchanges go). */
const quiet = (row: SharedConversation, side: Side) =>
  row.startedBy !== side && !row.messages.length && !row.exchanges.length;

const theirReadAt = (row: SharedConversation, side: Side) =>
  side === "seeker" ? row.employerReadAt : row.seekerReadAt;

function addRow(part: SharedPart, row: SharedConversation, side: Side, now: number, lang: Lang) {
  const id = sharedConversationId(row, side);
  const mine = side === "seeker" ? row.seekerReadAt : row.employerReadAt;
  const theirs = theirReadAt(row, side);
  const person =
    side === "seeker"
      ? row.employerName
      : row.seekerName === chatMessages.zh.times.seekerName
        ? pick(chatMessages, lang).times.seekerName
        : row.seekerName;
  part.conversations.push({
    id,
    person,
    title: row.jobTitle,
    time: chatTime(row.updatedAt, now, lang),
    avatar: person.slice(0, 1),
    job: row.jobId,
    ...(side === "seeker" ? { employerId: row.employerId } : row.candidateId ? { candidateId: row.candidateId } : {}),
  });
  part.added[id] = row.messages.map((m): Message => {
    const message: Message = {
      from: m.from === side ? "me" : "them",
      text: m.text,
      time: chatTime(m.sentAt, now, lang),
    };
    // A sent 中英文简历 (#379) reads as a card: its name and the contact details it carries, not the whole page (it
    // opens at /messages/resume/<id>); the text is the reader's words for it, for the list and a report.
    if (m.resume) {
      message.resume = { id: m.id, name: m.resume.zh.name, contact: contactKeys(m.resume.contact) };
      message.text = pick(chatMessages, lang).resumeCard.text(m.resume.zh.name);
    }
    message.sentAt = m.sentAt;
    if (message.from === "me" && theirs && theirs >= m.sentAt) message.readAt = theirs;
    if (m.from === "employer" && m.byName) message.by = m.byName;
    return message;
  });
  if (mine) part.readAt[id] = mine;
  if (row.exchanges.length) part.exchanges[id] = row.exchanges.map((item) => exchangeFor(item, side, lang));
}

/**
 * What changed in the shared conversations since a read, for the side reading (#369, ADR 0040). `order`: the ids of
 * all its shared conversations, newest first (a browser drops the ones that are not in it); `part`: the changed ones,
 * with only their new messages; `quiet`: changed ones the other side opened with no new message and no exchange,
 * shown only if the browser has them already (they had messages before); `theirReadAt`: how far the other side has
 * read each changed one, for the messages the browser has.
 */
export type SharedChanges = {
  order: string[];
  part: SharedPart;
  quiet: string[];
  theirReadAt: Record<string, string>;
};

export function sharedChanges(
  heads: Pick<SharedConversation, "id" | "employerId" | "jobId" | "updatedAt">[],
  changed: SharedConversation[],
  side: Side,
  now: number,
  lang: Lang = DEFAULT_LANG,
): SharedChanges {
  const changes: SharedChanges = {
    order: [...heads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((h) => sharedConversationId(h, side)),
    part: { conversations: [], added: {}, readAt: {}, exchanges: {} },
    quiet: [],
    theirReadAt: {},
  };
  for (const row of changed) {
    const id = sharedConversationId(row, side);
    addRow(changes.part, row, side, now, lang);
    if (quiet(row, side)) changes.quiet.push(id);
    const theirs = theirReadAt(row, side);
    if (theirs) changes.theirReadAt[id] = theirs;
  }
  return changes;
}

/**
 * The browser's copy with what changed applied: the record a full read gives, but for the times shown on what it had
 * already (they move on from 10:42 to 昨天 at the next full read, as when the page loads). `cached` is the copy as the
 * last answer left it; `own`, the identity's own record (withShared put its messages from before #110 ahead of the
 * shared ones, and those do not change).
 */
export function mergeSharedChanges(cached: ChatRecord, own: ChatRecord, changes: SharedChanges): ChatRecord {
  const fresh = new Map(changes.part.conversations.map((c) => [c.id, c]));
  const had = new Map(cached.extra.map((c) => [c.id, c]));
  const quietIds = new Set(changes.quiet);
  const part: SharedPart = { conversations: [], added: {}, readAt: {}, exchanges: {} };
  for (const id of changes.order) {
    const before = had.get(id);
    const now = fresh.get(id);
    // Not shown before and nothing said in it since: the other side's chat with nothing in it, or none at all.
    if (!before && (!now || quietIds.has(id))) continue;
    part.conversations.push(now ?? before!);
    const kept = before ? (cached.added[id] ?? []).slice(own.added[id]?.length ?? 0) : [];
    const theirs = changes.theirReadAt[id];
    part.added[id] = [
      ...kept.map((m) => (theirs && m.from === "me" && m.sentAt && m.sentAt <= theirs ? { ...m, readAt: theirs } : m)),
      ...(changes.part.added[id] ?? []),
    ];
    const readAt = now ? changes.part.readAt[id] : cached.readAt[id];
    if (readAt) part.readAt[id] = readAt;
    const exchanges = now ? changes.part.exchanges[id] : cached.exchanges[id];
    if (exchanges) part.exchanges[id] = exchanges;
  }
  return withShared(own, part);
}

/**
 * The identity's own record with its shared conversations in it, newest first. A job seeker's chat with a business
 * from before #110 has the same id as the shared one: its messages stay, before the shared ones (the business never
 * received them, ADR 0015).
 */
export function withShared(record: ChatRecord, part: SharedPart): ChatRecord {
  const ids = new Set(part.conversations.map((c) => c.id));
  const added = { ...record.added };
  for (const [id, list] of Object.entries(part.added)) added[id] = [...(record.added[id] ?? []), ...list];
  return {
    added,
    readAt: { ...record.readAt, ...part.readAt },
    extra: [...part.conversations, ...record.extra.filter((c) => !ids.has(c.id))],
    exchanges: { ...record.exchanges, ...part.exchanges },
    reports: record.reports,
  };
}
