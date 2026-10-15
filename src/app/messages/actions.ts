"use server";

// Chat, exchanges and read notifications on the server (#10), per identity of the signed-in account. The browser
// keeps a copy in localStorage as a cache (chat-client.ts, hub-client.ts); these are the records that count.
// Every change is checked and applied here with the same pure functions the browser uses (chat-store.ts), with
// the server's clock and ids.
import { randomUUID } from "node:crypto";
import { getCurrentSession, type SessionView } from "@/lib/auth";
import { getEmployer, getJob } from "@/lib/data";
import { chatServerStore } from "@/lib/chat-server/store";
import { parseChatReport, type ChatReportReason } from "@/lib/chat-report";
import { parsePayload, type ExchangeKind, type ExchangePayload } from "@/lib/chat-consent";
import { chatDemo } from "@/components/seeker/chat-demo";
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
import { identityScope } from "@/components/seeker/identity-scope";
import { initialNotifications } from "@/components/seeker/hub-state";
import { isExpired } from "@/components/seeker/job-facts";
import { MOCK_CANDIDATES } from "@/mock/candidates";

const MESSAGE_MAX = 2000;
const NAME_MAX = 40;

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
        { kind: "employer"; jobId: string } | { kind: "candidate"; jobId: string; candidateId: string; name: string };
    };

/** The signed-in identity: the session, its scope (as the browser's copy names it) and its demo. */
async function identity() {
  const session = await getCurrentSession();
  if (!session) return null;
  const isEmployer = session.activeRole === "employer";
  return { session, isEmployer, scope: scopeOf(session), demo: chatDemo(isEmployer) };
}

function scopeOf(session: SessionView): string {
  return identityScope({
    email: session.email,
    signedInAt: "",
    activeRole: session.activeRole,
    employerId: session.employer?.id,
  });
}

/** The signed-in identity's chat records; null when signed out. */
export async function myChat(): Promise<ChatRecord | null> {
  const me = await identity();
  if (!me) return null;
  return (await chatServerStore().getChat(me.scope)) ?? EMPTY_CHAT;
}

/** Applies one change and returns the records as they now are (unchanged when the change does not fit). */
export async function changeMyChat(change: ChatChange): Promise<ChatRecord | null> {
  const me = await identity();
  if (!me) return null;
  const store = chatServerStore();
  const current = (await store.getChat(me.scope)) ?? EMPTY_CHAT;
  const next = await apply(current, change, me);
  if (next !== current) await store.putChat(me.scope, next);
  return next;
}

/**
 * The browser's records from before #10 (kept only in localStorage), taken once: when the server has nothing for
 * that identity yet. Checked like anything else that comes from a browser.
 */
export async function importMyChat(record: unknown): Promise<ChatRecord | null> {
  const me = await identity();
  if (!me) return null;
  const store = chatServerStore();
  const current = await store.getChat(me.scope);
  if (current) return current;
  const parsed = parseChatRecord(record);
  if (!parsed) return EMPTY_CHAT;
  await store.putChat(me.scope, parsed);
  return parsed;
}

async function apply(
  record: ChatRecord,
  change: ChatChange,
  me: NonNullable<Awaited<ReturnType<typeof identity>>>,
): Promise<ChatRecord> {
  if (!change || typeof change !== "object") return record;
  const now = new Date().toISOString();
  const view = chatView(record, me.demo);
  const known =
    "conversationId" in change && typeof change.conversationId === "string" && view.messages[change.conversationId];

  switch (change.type) {
    case "read":
      return known ? markConversationRead(record, change.conversationId, now) : record;
    case "send": {
      const text = typeof change.text === "string" ? change.text.trim() : "";
      if (!known || !text || text.length > MESSAGE_MAX) return record;
      return addSentMessage(record, change.conversationId, text, now);
    }
    case "request": {
      const payload = parsePayload(change.payload);
      if (!known || !payload || !["contact", "resume"].includes(change.kind)) return record;
      return addExchangeRequest(record, me.demo, change.conversationId, change.kind, payload, randomUUID());
    }
    case "answer": {
      if (!known || typeof change.exchangeId !== "string") return record;
      if (!["accepted", "rejected", "cancelled"].includes(change.status)) return record;
      const payload = change.status === "accepted" ? parsePayload(change.payload) : undefined;
      if (change.status === "accepted" && !payload) return record;
      return answerExchange(record, me.demo, change.conversationId, change.exchangeId, change.status, payload);
    }
    case "report": {
      if (!known) return record;
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
    case "open":
      return openFor(record, change.conversation, me);
    default:
      return record;
  }
}

/** A chat about one active job: a job seeker with its employer, or an employer with a candidate for its own job. */
async function openFor(
  record: ChatRecord,
  target: Extract<ChatChange, { type: "open" }>["conversation"],
  me: NonNullable<Awaited<ReturnType<typeof identity>>>,
): Promise<ChatRecord> {
  if (!target || typeof target !== "object" || typeof target.jobId !== "string") return record;
  const job = await getJob(target.jobId);
  if (!job || job.status !== "active" || isExpired(job, Date.now())) return record;

  if (target.kind === "employer" && !me.isEmployer) {
    const employer = await getEmployer(job.employerId);
    if (!employer || employer.bannedAt || me.session.employer?.id === employer.id) return record;
    return openConversation(record, {
      id: `employer:${employer.id}:${job.id}`,
      person: employer.name,
      title: job.titleZh,
      time: "刚刚",
      avatar: employer.name.slice(0, 1),
      job: job.id,
      employerId: employer.id,
    });
  }

  if (target.kind === "candidate" && me.isEmployer && job.employerId === me.session.employer?.id) {
    if (typeof target.candidateId !== "string" || !target.candidateId) return record;
    // Demo candidates are known here; candidates who made a page in their own browser are not (yet), so their
    // name is the one the page shows.
    const known = MOCK_CANDIDATES.find((c) => c.id === target.candidateId)?.name;
    const name = (known ?? (typeof target.name === "string" ? target.name.trim() : "")).slice(0, NAME_MAX);
    if (!name) return record;
    return openConversation(record, {
      id: `recommend:${target.candidateId}:${job.id}`,
      person: name,
      title: job.titleZh,
      time: "刚刚",
      avatar: name.slice(0, 1),
      job: job.id,
      candidateId: target.candidateId,
    });
  }
  return record;
}

/** The ids of the notifications the signed-in identity has read; null when signed out. */
export async function myNotificationReads(): Promise<string[] | null> {
  const me = await identity();
  if (!me) return null;
  return (await chatServerStore().getNotificationReads(me.scope)) ?? [];
}

/** Marks notifications read: some ids, or "all" the identity has. Only ids its notifications have. */
export async function markMyNotificationsRead(ids: string[] | "all"): Promise<string[] | null> {
  const me = await identity();
  if (!me) return null;
  const store = chatServerStore();
  const mine = initialNotifications({
    email: me.session.email,
    signedInAt: "",
    activeRole: me.session.activeRole,
    employerId: me.session.employer?.id,
    employerName: me.session.employer?.name,
  }).map((n) => n.id);
  const asked = ids === "all" ? mine : Array.isArray(ids) ? ids.filter((id) => mine.includes(id)) : [];
  const read = [...new Set([...((await store.getNotificationReads(me.scope)) ?? []), ...asked])];
  await store.putNotificationReads(me.scope, read);
  return read;
}
