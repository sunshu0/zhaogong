"use server";

// Chat, exchanges and read notifications on the server (#10), per identity of the signed-in account. The browser
// keeps a copy in localStorage as a cache (chat-client.ts, hub-client.ts); these are the records that count.
// Every change is checked and applied here with the same pure functions the browser uses (chat-store.ts), with
// the server's clock and ids. A chat between a job seeker account and a business is one conversation both sides
// read and write (#110, ADR 0015): the server puts it into each side's record as it answers, and writes changes to
// it into the conversations tables; demo chats and reports stay in the identity's own record.
import { randomUUID } from "node:crypto";
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
  listSharedConversations,
  markSharedRead,
  openSharedConversation,
  type ConversationRow,
  type SharedReader,
} from "@/db/conversations";
import { parseSharedId, sharedConversationId, sharedPart, withShared } from "@/lib/chat-server/shared-view";
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
} from "@/components/seeker/chat-store";
import { initialNotifications } from "@/components/seeker/hub-state";
import { isExpired } from "@/components/seeker/job-facts";
import { normalizeEmail } from "@/components/seeker/session";
import { MOCK_CANDIDATES } from "@/mock/candidates";

const MESSAGE_MAX = 2000;
const NAME_MAX = 40;
/** Applied change ids kept per identity: far more than a browser sends before it hears back. */
const APPLIED_KEPT = 200;
const TICKET_ID = /^[A-Za-z0-9-]{8,64}$/;

export type ChatChange =
  | { type: "read"; conversationId: string }
  | { type: "send"; conversationId: string; text: string }
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
 * `open`, `opened` is the id of the conversation to show.
 */
export type ChatSnapshot = { scope: string; record: ChatRecord; opened?: string };
export type ReadsSnapshot = { scope: string; ids: string[] };

/** Whose shared conversations the identity sees: its own as a job seeker, its business's as an employer. */
function readerOf(me: ChatIdentity): SharedReader | null {
  if (!me.isEmployer) return { side: "seeker", email: me.session.email };
  return me.session.employer ? { side: "employer", employerId: me.session.employer.id } : null;
}

/** The identity's own record with the conversations it shares in it. */
async function withSharedOf(me: ChatIdentity, own: ChatRecord): Promise<ChatRecord> {
  const reader = readerOf(me);
  if (!reader) return own;
  return withShared(
    own,
    sharedPart(await listSharedConversations(reader), reader.side, Date.now(), await requestLang()),
  );
}

async function snapshot(me: ChatIdentity, own: ChatRecord, opened?: string): Promise<ChatSnapshot> {
  return { scope: me.scope, record: await withSharedOf(me, own), ...(opened ? { opened } : {}) };
}

/** The signed-in identity's chat records; null when signed out. */
export async function myChat(): Promise<ChatSnapshot | null> {
  const me = await currentChatIdentity();
  if (!me) return null;
  return snapshot(me, (await readChat(me)) ?? EMPTY_CHAT);
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
  const { record: next, opened } = await apply(current, change, me);
  if (next !== current) await store.putChat(me.recordScope, next);
  if (applied && ticket) await store.putAppliedChanges(me.scope, [...applied, ticket.id].slice(-APPLIED_KEPT));
  return snapshot(me, next, opened);
}

/**
 * The browser's records from before #10 (kept only in localStorage), taken once: when the server has nothing for
 * that identity yet. Checked like anything else that comes from a browser.
 */
export async function importMyChat(record: unknown): Promise<ChatSnapshot | null> {
  const me = await currentChatIdentity();
  if (!me) return null;
  const store = chatServerStore();
  const current = await readChat(me);
  if (current) return snapshot(me, current);
  const parsed = parseChatRecord(record);
  if (!parsed) return snapshot(me, EMPTY_CHAT);
  await store.putChat(me.recordScope, parsed);
  return snapshot(me, parsed);
}

type Applied = { record: ChatRecord; opened?: string };

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
      await applyShared(shared, change, me, reader.side, view);
      return { record };
    }
  }
  if (!view.messages[conversationId]) return { record };
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
  if (me.isEmployer || change.type !== "send" || !("jobId" in key)) return undefined;
  const opened = await openForSeeker(me, key.jobId);
  return opened && opened.employerId === key.employerId ? opened : undefined;
}

/** A change to a conversation both sides share, written to its rows. */
async function applyShared(
  row: ConversationRow,
  change: Exclude<ChatChange, { type: "open" } | { type: "report" }>,
  me: ChatIdentity,
  side: "seeker" | "employer",
  view: ReturnType<typeof chatView>,
): Promise<void> {
  const id = change.conversationId;
  switch (change.type) {
    case "read":
      return markSharedRead(row.id, side);
    case "send": {
      const text = typeof change.text === "string" ? change.text.trim() : "";
      if (!text || text.length > MESSAGE_MAX) return;
      if (side === "seeker") await countChatStart(id, me.session.email);
      return addSharedMessage(row.id, side, text, side === "employer" ? me.by : undefined);
    }
    case "request": {
      const payload = parsePayload(change.payload);
      if (!payload || !["contact", "resume"].includes(change.kind)) return;
      const current = view.exchanges[id] ?? [];
      const next = requestExchange(current, change.kind, payload, randomUUID());
      if (next === current) return;
      const created = next[next.length - 1];
      return addSharedExchange(row.id, {
        id: created.id,
        kind: created.kind,
        requestedBy: side,
        offered: created.offered,
        createdAt: created.createdAt,
      });
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
      return answerSharedExchange(row.id, item.id, {
        status: answered.status,
        ...(answered.response ? { response: answered.response } : {}),
        respondedAt: answered.respondedAt!,
      });
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

  // #84: someone who applied for one of the business's jobs; their name is the one on the page they applied with.
  if (target.kind === "applicant") {
    if (typeof target.applicationId !== "string") return { record };
    const application = await applicationOf(job.employerId, target.applicationId);
    if (!application || application.jobId !== job.id) return { record };
    return withAccount(application.seekerEmail, application.profile.name);
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
    return {
      record: openConversation(record, {
        id,
        person: demo.name,
        title: job.titleZh,
        time: pick(chatMessages, await requestLang()).times.justNow,
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
