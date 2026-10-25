"use server";

// Chat, exchanges and read notifications on the server (#10), per identity of the signed-in account. The browser
// keeps a copy in localStorage as a cache (chat-client.ts, hub-client.ts); these are the records that count.
// Every change is checked and applied here with the same pure functions the browser uses (chat-store.ts), with
// the server's clock and ids. A chat between a job seeker account and a business is one conversation both sides
// read and write (#110, ADR 0015): the server puts it into each side's record as it answers, and writes changes to
// it into the conversations tables; demo chats and reports stay in the identity's own record.
import { createHash, randomUUID } from "node:crypto";
import { getEmployer, getJob } from "@/lib/data";
import { currentChatIdentity, readChat, type ChatIdentity } from "@/lib/chat-server/identity";
import { chatServerStore } from "@/lib/chat-server/store";
import { countChatStart } from "@/db/job-stats";
import { applicationOf } from "@/db/job-applications";
import { getSeekerProfile, listDiscoverableSeekerProfiles } from "@/db/seeker-profiles";
import {
  addSharedExchange,
  addSharedMessage,
  answerSharedExchange,
  findSharedConversation,
  listSharedChanges,
  listSharedConversations,
  markSharedRead,
  newestMessageId,
  openSharedConversation,
  SHARED_MESSAGES_MAX,
  type ConversationRow,
  type SharedReader,
} from "@/db/conversations";
import {
  parseSharedId,
  sharedChanges,
  sharedConversationId,
  sharedPart,
  withShared,
  type SharedChanges,
} from "@/lib/chat-server/shared-view";
import { serverNotifications } from "@/app/[lang]/messages/server-notifications";
import { requestLang } from "@/i18n/server";
import { pick } from "@/i18n/messages";
import { chatMessages } from "@/i18n/messages/chat";
import { parseChatReport, type ChatReportReason } from "@/lib/chat-report";
import {
  parsePayload,
  requestExchange,
  respondExchange,
  type ExchangeKind,
  type ExchangePayload,
} from "@/lib/chat-consent";
import {
  EMPTY_CHAT,
  addExchangeRequest,
  addReport,
  addSentMessage,
  answerExchange,
  chatView,
  markConversationRead,
  openConversation,
  parseChatRecord,
  type ChatRecord,
  JUST_NOW,
  MESSAGE_MAX,
  RESUME_MESSAGE_TEXT,
} from "@/components/seeker/chat-store";
import { parseResumeDoc } from "@/components/seeker/resume-doc";
import { chatRiskRules } from "@/lib/chat-risk";
import { recordChatRisk } from "@/db/chat-risk";
import { initialNotifications } from "@/components/seeker/hub-state";
import { isExpired } from "@/components/seeker/job-facts";
import { normalizeEmail } from "@/components/seeker/session";
import { MOCK_CANDIDATES } from "@/mock/candidates";
import {
  OWN_CONVERSATIONS_MAX,
  OWN_MESSAGES_MAX,
  OWN_REPORTS_MAX,
  fitsOwnLimits,
  roomForMessage,
  roomForReport,
} from "@/lib/chat-server/own-limits";

const NAME_MAX = 40;
/** Applied change ids kept per identity: far more than a browser sends before it hears back. */
const APPLIED_KEPT = 200;
const TICKET_ID = /^[A-Za-z0-9-]{8,64}$/;

export type ChatChange =
  | { type: "read"; conversationId: string }
  | { type: "send"; conversationId: string; text: string }
  /** A job seeker sends their 中英文简历 (#379, ADR 0037): the page as their browser prints it, contact as ticked. */
  | { type: "resume"; conversationId: string; resume: unknown }
  | { type: "request"; conversationId: string; kind: ExchangeKind; payload: ExchangePayload }
  | {
      type: "answer";
      conversationId: string;
      exchangeId: string;
      status: "accepted" | "rejected" | "cancelled";
      payload?: ExchangePayload;
    }
  | { type: "report"; conversationId: string; reason: ChatReportReason; note: string; messageIndex?: number }
  | {
      type: "open";
      conversation:
        | { kind: "employer"; jobId: string }
        | { kind: "candidate"; jobId: string; candidateId: string; name: string }
        | { kind: "applicant"; jobId: string; applicationId: string };
    };

/**
 * What the server answers with: the records and the identity they belong to (the browser's copy may name another
 * identity while a switch or sign-in is under way; it keeps an answer only under the scope it is for). After an
 * `open`, `opened` is the id of the conversation to show. `notice`, in the visitor's language, says why a message
 * or an import or a report was not taken (a size: SHARED_MESSAGES_MAX, own-limits.ts). `cursor`, in an answer to
 * myChatChanges, is where the next read of changes starts.
 */
export type ChatSnapshot = { scope: string; record: ChatRecord; opened?: string; notice?: string; cursor?: ChatCursor };
export type ReadsSnapshot = { scope: string; ids: string[] };

/**
 * Where a read of changes starts (#369, ADR 0040): the newest message id the browser has, and a time a little before
 * its last read began; conversations read or written to after it count as changed.
 */
export type ChatCursor = { messageId: number; at: string };

/**
 * The changes since a cursor: the shared conversations' (SharedChanges), and the own record only when it is not the
 * one the browser has (`ownTag` names it).
 */
export type ChatChanges = {
  scope: string;
  cursor: ChatCursor;
  ownTag: string;
  own?: ChatRecord;
  shared: SharedChanges;
};

/**
 * How far before a read its cursor's time is: a write that took its time before the read began but was not in the
 * database yet when it read is still after the cursor. A changed conversation may come twice; that does no harm.
 */
const CURSOR_SLACK_MS = 30_000;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const TAG = /^[A-Za-z0-9_-]{1,64}$/;

const cursorAt = () => new Date(Date.now() - CURSOR_SLACK_MS).toISOString();
const tagOf = (own: ChatRecord) => createHash("sha256").update(JSON.stringify(own)).digest("base64url").slice(0, 22);

/** Whose shared conversations the identity sees: its own as a job seeker, its business's as an employer. */
function readerOf(me: ChatIdentity): SharedReader | null {
  if (!me.isEmployer) return { side: "seeker", email: me.session.email };
  return me.session.employer ? { side: "employer", employerId: me.session.employer.id } : null;
}

/** The identity's own record with the conversations it shares in it; with `upTo`, their messages up to that id. */
async function withSharedOf(me: ChatIdentity, own: ChatRecord, upTo?: number): Promise<ChatRecord> {
  const reader = readerOf(me);
  if (!reader) return own;
  return withShared(
    own,
    sharedPart(await listSharedConversations(reader, upTo), reader.side, Date.now(), await requestLang()),
  );
}

async function snapshot(me: ChatIdentity, own: ChatRecord, opened?: string, notice?: string): Promise<ChatSnapshot> {
  return {
    scope: me.scope,
    record: await withSharedOf(me, own),
    ...(opened ? { opened } : {}),
    ...(notice ? { notice } : {}),
  };
}

/** The visitor's words for a size of a conversation or of the own record. */
async function limits() {
  return pick(chatMessages, await requestLang()).limits;
}

/** The signed-in identity's chat records; null when signed out. */
export async function myChat(): Promise<ChatSnapshot | null> {
  const me = await currentChatIdentity();
  if (!me) return null;
  return snapshot(me, (await readChat(me)) ?? EMPTY_CHAT);
}

/**
 * The chat page's read every 10 seconds (#369, ADR 0040): what changed since `since` (the last answer's cursor, and
 * the tag of the own record the browser has), so a quiet chat answers with almost nothing however many conversations
 * it has. Without a cursor the browser has (a new page, a new device, a full answer kept since), the whole records,
 * with a cursor to go on from.
 */
export async function myChatChanges(since: unknown): Promise<ChatSnapshot | ChatChanges | null> {
  const me = await currentChatIdentity();
  if (!me) return null;
  const own = (await readChat(me)) ?? EMPTY_CHAT;
  const at = cursorAt();
  const upTo = await newestMessageId();
  const asked = parseSince(since);
  // A cursor past the newest message is not from this database (one reset since): read everything.
  if (!asked || asked.cursor.messageId > upTo)
    return { scope: me.scope, record: await withSharedOf(me, own, upTo), cursor: { messageId: upTo, at } };
  const reader = readerOf(me);
  const { heads, changed } = reader ? await listSharedChanges(reader, asked.cursor, upTo) : { heads: [], changed: [] };
  const ownTag = tagOf(own);
  return {
    scope: me.scope,
    cursor: { messageId: upTo, at },
    ownTag,
    ...(asked.ownTag === ownTag ? {} : { own }),
    shared: sharedChanges(heads, changed, reader?.side ?? "seeker", Date.now(), await requestLang()),
  };
}

function parseSince(since: unknown): { cursor: ChatCursor; ownTag?: string } | undefined {
  if (!since || typeof since !== "object") return undefined;
  const { cursor, ownTag } = since as { cursor?: Partial<ChatCursor>; ownTag?: unknown };
  if (!cursor || typeof cursor !== "object") return undefined;
  const { messageId, at } = cursor;
  if (!Number.isSafeInteger(messageId) || messageId! < 0) return undefined;
  if (typeof at !== "string" || !ISO_TIME.test(at) || Number.isNaN(Date.parse(at))) return undefined;
  return {
    cursor: { messageId: messageId!, at },
    ...(typeof ownTag === "string" && TAG.test(ownTag) ? { ownTag } : {}),
  };
}

/** The browser's outbox entry for a change (chat-outbox.ts): its id, and the identity it was made in. */
export type ChangeTicket = { id: string; scope: string };

/**
 * Applies one change and returns the records as they now are (unchanged when the change does not fit). With a
 * ticket, the change is applied once however often it is sent, and only while the session is the identity it was
 * made in (during a switch the browser waits and sends it again).
 */
export async function changeMyChat(change: ChatChange, ticket?: ChangeTicket): Promise<ChatSnapshot | null> {
  const me = await currentChatIdentity();
  if (!me) return null;
  const store = chatServerStore();
  const current = (await readChat(me)) ?? EMPTY_CHAT;
  let applied: string[] | undefined;
  if (ticket !== undefined) {
    if (!ticket || typeof ticket.id !== "string" || !TICKET_ID.test(ticket.id) || ticket.scope !== me.scope) {
      return snapshot(me, current);
    }
    applied = (await store.getAppliedChanges(me.scope)) ?? [];
    if (applied.includes(ticket.id)) return snapshot(me, current);
  }
  const { record: next, opened, notice } = await apply(current, change, me);
  if (next !== current) await store.putChat(me.recordScope, next);
  if (applied && ticket) await store.putAppliedChanges(me.scope, [...applied, ticket.id].slice(-APPLIED_KEPT));
  return snapshot(me, next, opened, notice);
}

/**
 * The browser's records from before #10 (kept only in localStorage), taken once: when the server has nothing for
 * that identity yet. Checked like anything else that comes from a browser; a record over the own record's sizes
 * (own-limits.ts) is not taken, and the answer says so.
 */
export async function importMyChat(record: unknown): Promise<ChatSnapshot | null> {
  const me = await currentChatIdentity();
  if (!me) return null;
  const store = chatServerStore();
  const current = await readChat(me);
  if (current) return snapshot(me, current);
  const parsed = parseChatRecord(record);
  if (!parsed) return snapshot(me, EMPTY_CHAT);
  if (!fitsOwnLimits(parsed)) return snapshot(me, EMPTY_CHAT, undefined, (await limits()).importTooBig);
  await store.putChat(me.recordScope, parsed);
  return snapshot(me, parsed);
}

type Applied = { record: ChatRecord; opened?: string; notice?: string };

async function apply(record: ChatRecord, change: ChatChange, me: ChatIdentity): Promise<Applied> {
  if (!change || typeof change !== "object") return { record };
  if (change.type === "open") return openFor(record, change.conversation, me);
  const reader = readerOf(me);
  const view = chatView(await withSharedOf(me, record), me.demo);
  const conversationId = "conversationId" in change ? change.conversationId : undefined;
  if (typeof conversationId !== "string") return { record };
  // Reports stay with the reporter, whatever the conversation.
  const key = reader && parseSharedId(conversationId, reader.side);
  if (reader && key && change.type !== "report") {
    const shared = (await findSharedConversation(reader, key)) ?? (await sharedToStart(me, key, change));
    if (shared) {
      const notice = await applyShared(shared, change, me, reader.side, view);
      return notice ? { record, notice } : { record };
    }
  }
  // A résumé goes only to a business on the platform, in a conversation both share: never to a demo chat.
  if (change.type === "resume" || !view.messages[conversationId]) return { record };
  if (change.type === "send" && !roomForMessage(record, conversationId))
    return { record, notice: (await limits()).messagesFull(OWN_MESSAGES_MAX) };
  if (change.type === "report" && !roomForReport(record))
    return { record, notice: (await limits()).reportsFull(OWN_REPORTS_MAX) };
  return { record: applyOwn(record, change, me, view) };
}

/**
 * A job seeker's message to a business they have no shared conversation with yet starts one, if they could open it
 * now: a chat from before #110 (only in their own record), or a message that got here before its `open` (the
 * browser sends both at once).
 */
async function sharedToStart(
  me: ChatIdentity,
  key: NonNullable<ReturnType<typeof parseSharedId>>,
  change: ChatChange,
): Promise<ConversationRow | undefined> {
  if (me.isEmployer || (change.type !== "send" && change.type !== "resume") || !("jobId" in key)) return undefined;
  const opened = await openForSeeker(me, key.jobId);
  return opened && opened.employerId === key.employerId ? opened : undefined;
}

/** A change to a conversation both sides share, written to its rows; what to tell the sender when it is not taken. */
async function applyShared(
  row: ConversationRow,
  change: Exclude<ChatChange, { type: "open" } | { type: "report" }>,
  me: ChatIdentity,
  side: "seeker" | "employer",
  view: ReturnType<typeof chatView>,
): Promise<string | undefined> {
  const id = change.conversationId;
  switch (change.type) {
    case "read":
      await markSharedRead(row.id, side);
      return;
    case "send": {
      const text = typeof change.text === "string" ? change.text.trim() : "";
      if (!text || text.length > MESSAGE_MAX) return;
      if (side === "seeker") await countChatStart(id, me.session.email);
      const now = new Date();
      if (await addSharedMessage(row.id, side, text, side === "employer" ? me.by : undefined, now)) {
        // 聊天风险 (#384, ADR 0039): only the business's messages count towards telling a moderator; a job seeker
        // asking 要交押金吗 is not reported. Both sides still see their reminders in the chat.
        const rules = side === "employer" ? chatRiskRules(text) : [];
        if (rules.length) {
          await recordChatRisk({
            employerId: row.employerId,
            conversationId: row.id,
            sentAt: now.toISOString(),
            rules,
          }).catch((error: unknown) => console.error("chat risk: not recorded", error));
        }
        return;
      }
      return (await limits()).messagesFull(SHARED_MESSAGES_MAX);
    }
    case "resume": {
      // Only the job seeker's own page, as their browser sent it; checked like the share link's, email kept.
      if (side !== "seeker") return;
      const resume = parseResumeDoc(change.resume, { withEmail: true });
      if (!resume) return;
      await countChatStart(id, me.session.email);
      if (await addSharedMessage(row.id, side, RESUME_MESSAGE_TEXT, undefined, new Date(), resume)) return;
      return (await limits()).messagesFull(SHARED_MESSAGES_MAX);
    }
    case "request": {
      const payload = parsePayload(change.payload);
      if (!payload || !["contact", "resume"].includes(change.kind)) return;
      const current = view.exchanges[id] ?? [];
      const next = requestExchange(current, change.kind, payload, randomUUID());
      if (next === current) return;
      const created = next[next.length - 1];
      await addSharedExchange(
        row.id,
        {
          id: created.id,
          kind: created.kind,
          requestedBy: side,
          offered: created.offered,
          createdAt: created.createdAt,
        },
        // The oldest closed requests of the kind the new one leaves out (#366).
        current.filter((item) => !next.includes(item)).map((item) => item.id),
      );
      return;
    }
    case "answer": {
      if (typeof change.exchangeId !== "string") return;
      if (!["accepted", "rejected", "cancelled"].includes(change.status)) return;
      const payload = change.status === "accepted" ? parsePayload(change.payload) : undefined;
      if (change.status === "accepted" && !payload) return;
      const item = view.exchanges[id]?.find((x) => x.id === change.exchangeId);
      if (!item) return;
      const answered = respondExchange(item, "me", change.status, payload);
      if (answered === item) return;
      await answerSharedExchange(row.id, item.id, {
        status: answered.status,
        ...(answered.response ? { response: answered.response } : {}),
        respondedAt: answered.respondedAt!,
      });
      return;
    }
  }
}

/** A change to the identity's own record: demo chats, chats with demo candidates, reports. */
function applyOwn(
  record: ChatRecord,
  change: Exclude<ChatChange, { type: "open" }>,
  me: ChatIdentity,
  view: ReturnType<typeof chatView>,
): ChatRecord {
  const now = new Date().toISOString();
  switch (change.type) {
    case "read":
      return markConversationRead(record, change.conversationId, now);
    case "send": {
      const text = typeof change.text === "string" ? change.text.trim() : "";
      if (!text || text.length > MESSAGE_MAX) return record;
      return addSentMessage(record, change.conversationId, text, now, me.by);
    }
    case "request": {
      const payload = parsePayload(change.payload);
      if (!payload || !["contact", "resume"].includes(change.kind)) return record;
      return addExchangeRequest(record, me.demo, change.conversationId, change.kind, payload, randomUUID());
    }
    case "answer": {
      if (typeof change.exchangeId !== "string") return record;
      if (!["accepted", "rejected", "cancelled"].includes(change.status)) return record;
      const payload = change.status === "accepted" ? parsePayload(change.payload) : undefined;
      if (change.status === "accepted" && !payload) return record;
      return answerExchange(record, me.demo, change.conversationId, change.exchangeId, change.status, payload);
    }
    case "report": {
      // The evidence may come from a shared conversation: the view has it.
      const conversation = view.conversations.find((c) => c.id === change.conversationId)!;
      const thread = view.messages[change.conversationId];
      const index = change.messageIndex;
      if (index !== undefined && thread[index]?.from !== "them") return record;
      const report = parseChatReport({
        id: randomUUID(),
        conversationId: conversation.id,
        targetName: conversation.person,
        targetRole: me.isEmployer ? "seeker" : "employer",
        reason: change.reason,
        note: typeof change.note === "string" ? change.note.trim() : "",
        evidence: index !== undefined ? [thread[index]] : thread.slice(-100),
        createdAt: now,
        ...(index !== undefined ? { messageIndex: index } : {}),
      });
      return report ? addReport(record, report) : record;
    }
    default:
      return record;
  }
}

/**
 * The conversation of a job seeker with the business of one of its active jobs: not a banned business, not their
 * own. Made the first time; undefined when the job seeker may not chat about the job.
 */
async function openForSeeker(me: ChatIdentity, jobId: string): Promise<ConversationRow | undefined> {
  const job = await getJob(jobId);
  if (!job || job.status !== "active" || isExpired(job, Date.now())) return undefined;
  const employer = await getEmployer(job.employerId);
  if (!employer || employer.bannedAt || me.session.employer?.id === employer.id) return undefined;
  const page = await getSeekerProfile(me.session.email);
  return openSharedConversation({
    seekerEmail: me.session.email,
    employerId: employer.id,
    jobId: job.id,
    startedBy: "seeker",
    seekerName: page?.profile.name,
  });
}

/**
 * A chat about one active job: a job seeker with its business, or a business with someone who applied for its job
 * or a candidate for it. With an account on the other side it is the conversation both share (#110); with a demo
 * candidate, a conversation in the business's own record.
 */
async function openFor(
  record: ChatRecord,
  target: Extract<ChatChange, { type: "open" }>["conversation"],
  me: ChatIdentity,
): Promise<Applied> {
  if (!target || typeof target !== "object" || typeof target.jobId !== "string") return { record };

  if (target.kind === "employer" && !me.isEmployer) {
    const row = await openForSeeker(me, target.jobId);
    return row ? { record, opened: sharedConversationId({ ...row, jobId: row.jobId! }, "seeker") } : { record };
  }

  const job = await getJob(target.jobId);
  if (!job || job.status !== "active" || isExpired(job, Date.now())) return { record };
  if (!me.isEmployer || job.employerId !== me.session.employer?.id) return { record };
  const withAccount = async (seekerEmail: string, seekerName: string): Promise<Applied> => {
    if (normalizeEmail(seekerEmail) === normalizeEmail(me.session.email)) return { record };
    const row = await openSharedConversation({
      seekerEmail,
      employerId: job.employerId,
      jobId: job.id,
      startedBy: "employer",
      seekerName,
    });
    return { record, opened: sharedConversationId({ ...row, jobId: job.id }, "employer") };
  };

  // #84: one of the job's candidates (ADR 0030); the name is the one on the page they applied with, if they did (a
  // candidate from a chat has their conversation already, with its name).
  if (target.kind === "applicant") {
    if (typeof target.applicationId !== "string") return { record };
    const application = await applicationOf(job.employerId, target.applicationId);
    if (!application || application.jobId !== job.id) return { record };
    return withAccount(application.seekerEmail, application.profile?.name ?? "");
  }

  if (target.kind === "candidate") {
    if (typeof target.candidateId !== "string" || !target.candidateId) return { record };
    // A candidate with a page on their account (#104) has a conversation both sides share; demo candidates are
    // not accounts, so their chat stays in the business's own record.
    const demo = MOCK_CANDIDATES.find((c) => c.id === target.candidateId);
    if (!demo) {
      const page = (await listDiscoverableSeekerProfiles()).find(
        (row) => `local-${row.profile.resume?.candidateId}` === target.candidateId,
      );
      const name = page?.profile.name?.trim();
      return page && name ? withAccount(page.email, name.slice(0, NAME_MAX)) : { record };
    }
    const id = `recommend:${demo.id}:${job.id}`;
    if (!record.extra.some((c) => c.id === id) && record.extra.length >= OWN_CONVERSATIONS_MAX)
      return { record, notice: (await limits()).conversationsFull(OWN_CONVERSATIONS_MAX) };
    return {
      record: openConversation(record, {
        id,
        person: demo.name,
        title: job.titleZh,
        time: JUST_NOW,
        avatar: demo.name.slice(0, 1),
        job: job.id,
        candidateId: demo.id,
      }),
      opened: id,
    };
  }
  return { record };
}

/** The ids of the notifications the signed-in identity has read; null when signed out. */
export async function myNotificationReads(): Promise<ReadsSnapshot | null> {
  const me = await currentChatIdentity();
  if (!me) return null;
  return { scope: me.scope, ids: (await chatServerStore().getNotificationReads(me.scope)) ?? [] };
}

/** Marks notifications read: some ids, or "all" the identity has. Only ids its notifications have (alerts' too). */
export async function markMyNotificationsRead(ids: string[] | "all"): Promise<ReadsSnapshot | null> {
  const me = await currentChatIdentity();
  if (!me) return null;
  const store = chatServerStore();
  const mine = initialNotifications({
    email: me.session.email,
    signedInAt: "",
    activeRole: me.session.activeRole,
    employerId: me.session.employer?.id,
    employerName: me.session.employer?.name,
  }).map((n) => n.id);
  // The same list the notifications page shows (#94), so every kind it shows can be marked read.
  const fromServer = await serverNotifications(
    { email: me.session.email, isEmployer: me.isEmployer },
    Date.now(),
    await requestLang(),
  );
  mine.push(...fromServer.map((n) => n.id));
  const asked = ids === "all" ? mine : Array.isArray(ids) ? ids.filter((id) => mine.includes(id)) : [];
  const read = [...new Set([...((await store.getNotificationReads(me.scope)) ?? []), ...asked])];
  await store.putNotificationReads(me.scope, read);
  return { scope: me.scope, ids: read };
}
