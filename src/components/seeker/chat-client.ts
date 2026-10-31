"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  changeMyChat,
  importMyChat,
  myChatChanges,
  type ChatChange,
  type ChatChanges,
  type ChatCursor,
  type ChatSnapshot,
} from "@/app/[lang]/messages/actions";
import { mergeSharedChanges } from "@/lib/chat-server/shared-view";
import { createLocalStore } from "@/components/seeker/local-store";
import { useSession } from "@/components/seeker/session-client";
import { identityScope, stringifyStoredIdentities } from "@/components/seeker/identity-scope";
import type { Candidate } from "@/lib/candidate-matching";
import type { Employer, Job } from "@/lib/types";
import type { ExchangeKind, ExchangePayload } from "@/lib/chat-consent";
import { parseChatReport, type ChatReportReason } from "@/lib/chat-report";
import { contactKeys, type ResumeDoc } from "@/components/seeker/resume-doc";
import { chatDemo } from "@/components/seeker/chat-demo";
import { isDemoAccount } from "@/lib/demo-accounts";
import { addToOutbox, outboxFor, removeFromOutbox, type OutboxItem } from "@/components/seeker/chat-outbox";
import { toast } from "@/components/ui/Toast";
import { refreshModeratorChat, useModeratorChat } from "@/components/seeker/moderator-chat-client";
import { useLang } from "@/i18n/client";
import type { Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { chatMessages } from "@/i18n/messages/chat";
import { CHAT_REFRESH_MS } from "@/components/seeker/chat-refresh";
import {
  EMPTY_CHAT,
  addExchangeRequest,
  addReport,
  addSentMessage,
  addSentResume,
  answerExchange,
  chatView,
  markConversationRead,
  markConversationUnread,
  openConversation,
  parseChats as parseStoredChats,
  pinConversation,
  pinsFull,
  type ChatRecord,
  type Conversation,
  JUST_NOW,
  MESSAGE_MAX,
  PINS_MAX,
} from "@/components/seeker/chat-store";

export type { Conversation, Message } from "@/components/seeker/chat-store";
export { CONVERSATIONS } from "@/components/seeker/chat-demo";

export function conversationProfileHref(conversation: Conversation, isEmployer: boolean): string | undefined {
  if (!isEmployer)
    return conversation.employerId ? `/employers/${encodeURIComponent(conversation.employerId)}` : undefined;
  // Demo conversations are named after the candidate; a shared one (chat:…) names its candidate only when the job
  // seeker lets businesses find them.
  const candidateId =
    conversation.candidateId ??
    (conversation.id.startsWith("recommend:")
      ? conversation.id.split(":")[1]
      : conversation.id.includes(":")
        ? undefined
        : conversation.id);
  return candidateId ? `/candidates/${encodeURIComponent(candidateId)}` : undefined;
}

export const CHAT_KEY = "zhaogong:chat-demo";
export function parseChats(raw: string | null): Record<string, ChatRecord> {
  // Data from before versioning was stored with the whole demo in it; telling it apart needs the full demo.
  return parseStoredChats(raw, (isEmployer) => chatDemo(isEmployer, true));
}
const store = createLocalStore(CHAT_KEY, parseChats);

// What the person hears about delivery (#253). The outbox lives in localStorage, so its changes are announced here;
// `unreached` holds the identities whose last call to the server got no answer (sending, reading again, opening).
const deliveryListeners = new Set<() => void>();
let unreached: ReadonlySet<string> = new Set();

function announceDelivery() {
  for (const listener of deliveryListeners) listener();
}

function setUnreached(scope: string, on: boolean) {
  if (unreached.has(scope) === on) return;
  const next = new Set(unreached);
  if (on) next.add(scope);
  else next.delete(scope);
  unreached = next;
  announceDelivery();
}

/**
 * Per identity, where the next read of changes starts (#369, ADR 0040), for the copy kept last, and the own record
 * the last changes came with (and its tag). Only for this page: a new page reads everything once.
 */
type Sync = { cursor?: ChatCursor; own?: ChatRecord; ownTag?: string };
const syncs = new Map<string, Sync>();

/**
 * Keeps the server's answer as the copy of the identity it is for. The cookie decides which identity the server
 * answers for; during a switch or sign-in that may not be the one asked about, so the answer names its scope. Its
 * cursor goes with it; an answer without one (to a change) means the next read is a whole one.
 */
function keep(snapshot: ChatSnapshot | null) {
  if (!snapshot) return;
  store.update((storage) => {
    const current = parseChats(storage.getItem(CHAT_KEY));
    storage.setItem(CHAT_KEY, stringifyStoredIdentities({ ...current, [snapshot.scope]: snapshot.record }));
  });
  syncs.set(snapshot.scope, { ...syncs.get(snapshot.scope), cursor: snapshot.cursor });
}

/** Applies changes to the kept copy; false when there is none to apply them to, or no own record to go with. */
function keepChanges(changes: ChatChanges, sync: Sync | undefined): boolean {
  const own = changes.own ?? sync?.own;
  if (!own) return false;
  const kept =
    store.update((storage) => {
      const current = parseChats(storage.getItem(CHAT_KEY));
      const cached = current[changes.scope];
      if (!cached) return false;
      const record = mergeSharedChanges(cached, own, changes.shared);
      storage.setItem(CHAT_KEY, stringifyStoredIdentities({ ...current, [changes.scope]: record }));
      return true;
    }) === true;
  if (kept) syncs.set(changes.scope, { cursor: changes.cursor, own, ownTag: changes.ownTag });
  return kept;
}

const isEmpty = (record: ChatRecord) =>
  !Object.keys(record.added).length &&
  !Object.keys(record.readAt).length &&
  !record.extra.length &&
  !Object.keys(record.exchanges).length &&
  !record.reports.length &&
  !record.pinned &&
  !record.unreadMarks;

// The server's records are the truth (#10); this browser's copy is a cache, refreshed once per identity per page
// load, after sending what the outbox still holds. Records from before #10 that only this browser has are handed
// to the server once.
const syncedScopes = new Set<string>();

function syncScope(scope: string) {
  if (syncedScopes.has(scope)) return;
  syncedScopes.add(scope);
  (async () => {
    await sendWaitingChanges(scope);
    const server = await myChatChanges(null);
    // Signed out, or another identity; a whole answer, as asked for without a cursor.
    if (!server || server.scope !== scope || !("record" in server)) return syncedScopes.delete(scope);
    const local = store.update((storage) => parseChats(storage.getItem(CHAT_KEY))[scope]);
    const kept = isEmpty(server.record) && local && !isEmpty(local) ? await importMyChat(local) : server;
    keep(kept);
    if (kept?.notice) toast(kept.notice, 8000);
    setUnreached(scope, false);
  })().catch(() => {
    syncedScopes.delete(scope);
    setUnreached(scope, true);
  });
}

/**
 * Sends one change to the server and keeps its answer (the browser has already shown the change). It waits in the
 * outbox until the server has it, so leaving the page first does not lose it.
 */
function sendChange(scope: string, change: ChatChange) {
  const item: OutboxItem = { id: crypto.randomUUID(), scope, change };
  addToOutbox(localStorage, item);
  announceDelivery();
  deliver(item).catch(() => setUnreached(scope, true));
}

/**
 * Sends what the outbox still holds for one identity, oldest first. A change that cannot be sent now stays for the
 * next page load. Pages that read chat-derived facts from the server (收藏和进度) call it first.
 */
export async function sendWaitingChanges(scope: string): Promise<void> {
  for (const item of outboxFor(localStorage, scope)) {
    const sent = await deliver(item).catch(() => {
      setUnreached(scope, true);
      return false;
    });
    if (!sent) break;
  }
}

/**
 * Reads the identity's chat again, for messages the other side sent since (#110: there is no push): only what changed
 * since the last answer kept (#369, ADR 0040). What this browser has not sent yet goes first; an answer that comes
 * back while more is waiting is not kept, so a message just shown does not blink away, and neither is one when
 * another answer was kept meanwhile (its changes may be in the copy already; the next read has them).
 */
async function refreshChat(scope: string): Promise<void> {
  await sendWaitingChanges(scope);
  const sync = syncs.get(scope);
  const since = sync?.cursor ? { cursor: sync.cursor, ...(sync.ownTag ? { ownTag: sync.ownTag } : {}) } : null;
  const server = await myChatChanges(since);
  setUnreached(scope, false);
  if (server?.scope !== scope || outboxFor(localStorage, scope).length || syncs.get(scope) !== sync) return;
  if ("record" in server) return keep(server);
  if (!keepChanges(server, sync)) {
    // Nothing to apply them to: read everything.
    syncs.delete(scope);
    const whole = await myChatChanges(null);
    if (whole?.scope === scope && "record" in whole && !outboxFor(localStorage, scope).length) keep(whole);
  }
}

export { CHAT_REFRESH_MS };

/** Keeps the signed-in identity's chat fresh while the page is in front, and when it comes back to it. */
export function useChatRefresh(): void {
  const session = useSession();
  const scope = identityScope(session);
  const signedIn = Boolean(session);
  useEffect(() => {
    if (!signedIn) return;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      refreshChat(scope).catch(() => setUnreached(scope, true));
      void refreshModeratorChat(scope); // ADR 0046
    };
    const timer = window.setInterval(refresh, CHAT_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [signedIn, scope]);
}

/**
 * Opens a chat on the server and keeps the answer; the id of the conversation to show, or null when it cannot be
 * opened. A business's chat with an account gets its id from the server, so this one waits for it.
 */
async function openOnServer(
  scope: string,
  conversation: Extract<ChatChange, { type: "open" }>["conversation"],
  lang: Lang,
) {
  const snapshot = await changeMyChat({ type: "open", conversation }).catch(() => undefined);
  if (snapshot === undefined) {
    // No answer (#253): said, rather than a 发起聊天 that does nothing.
    setUnreached(scope, true);
    toast(pick(chatMessages, lang).delivery.openFailed, 8000);
    return null;
  }
  if (snapshot?.scope !== scope) return null;
  keep(snapshot);
  if (snapshot.notice) toast(snapshot.notice, 8000);
  // Refused with no reason of its own (the job closed or expired, the application or the candidate's page gone since
  // the page loaded): said too, so the button does not just spring back (UI review 3, B7 B8).
  else if (!snapshot.opened) toast(pick(chatMessages, lang).delivery.openRefused, 8000);
  return snapshot.opened ?? null;
}

/** True once the server has the change for the identity it was made in; it then leaves the outbox. */
async function deliver(item: OutboxItem): Promise<boolean> {
  const snapshot = await changeMyChat(item.change, { id: item.id, scope: item.scope });
  keep(snapshot);
  // Not taken for a size: said, since the browser showed the change already.
  if (snapshot?.notice) toast(snapshot.notice, 8000);
  if (snapshot?.scope !== item.scope) return false;
  removeFromOutbox(localStorage, item.id);
  announceDelivery();
  setUnreached(item.scope, false);
  return true;
}

const subscribeDelivery = (listener: () => void) => {
  deliveryListeners.add(listener);
  return () => deliveryListeners.delete(listener);
};

/** "waiting:unsent:unreached" for one conversation: a string, so the store's snapshot compares by value. */
function deliveryKey(scope: string, conversationId: string): string {
  const mine = outboxFor(localStorage, scope).filter(
    (item) => "conversationId" in item.change && item.change.conversationId === conversationId,
  );
  const waiting = mine.filter((item) => item.change.type !== "read").length;
  // A résumé shows in the log as a message too (#379).
  const unsent = mine.filter((item) => item.change.type === "send" || item.change.type === "resume").length;
  return `${waiting}:${unsent}:${unreached.has(scope) ? 1 : 0}`;
}

/**
 * What one conversation still has to send (#253): `waiting` changes (messages, exchanges, a report; not reads),
 * of which `unsent` are messages, the last ones this browser sent, since the outbox goes oldest first; `unreached`
 * when the last call got no answer. `retry` sends what waits and reads the chat again.
 */
export function useChatDelivery(conversationId: string): {
  waiting: number;
  unsent: number;
  unreached: boolean;
  retry: () => void;
} {
  const session = useSession();
  const scope = identityScope(session);
  const key = useSyncExternalStore(
    subscribeDelivery,
    () => (session ? deliveryKey(scope, conversationId) : "0:0:0"),
    () => "0:0:0",
  );
  const [waiting, unsent, off] = key.split(":").map(Number);
  return {
    waiting,
    unsent,
    unreached: off === 1,
    retry: () => void refreshChat(scope).catch(() => setUnreached(scope, true)),
  };
}

export function useChat() {
  const session = useSession();
  const accounts = store.useValue();
  const scope = identityScope(session);
  const isEmployer = session?.activeRole === "employer";
  const lang = useLang();
  const demo = chatDemo(isEmployer, isDemoAccount(session?.email));
  const record = accounts[scope] ?? EMPTY_CHAT;
  // Memoized: pages keep `messages` and the like in effect dependencies.
  const view = useMemo(() => chatView(record, demo), [record, demo]);
  // ADR 0046: the business's conversation with the moderators counts in what waits unread.
  const moderatorUnread = useModeratorChat().unread;
  const signedIn = Boolean(session);
  useEffect(() => {
    if (signedIn) syncScope(scope);
  }, [signedIn, scope]);

  function change(update: (current: ChatRecord) => ChatRecord) {
    if (!session) return;
    return store.update((storage) => {
      const current = parseChats(storage.getItem(CHAT_KEY));
      storage.setItem(
        CHAT_KEY,
        stringifyStoredIdentities({ ...current, [scope]: update(current[scope] ?? EMPTY_CHAT) }),
      );
      return true;
    });
  }

  return {
    ...view,
    totalUnread: session ? Object.values(view.unread).reduce((total, count) => total + count, moderatorUnread) : 0,
    markRead(id: string) {
      if (!view.messages[id]) return;
      const allRead = !view.unread[id] && view.messages[id].every((message) => message.from === "me" || message.readAt);
      if (allRead && !view.unreadMarks[id]) return;
      change((current) => markConversationRead(current, id, new Date().toISOString()));
      sendChange(scope, { type: "read", conversationId: id });
    },
    /** C7: pins the conversation to the top of the list, or takes the pin off; past PINS_MAX it says so instead. */
    pin(id: string, pinned: boolean) {
      if (!view.messages[id]) return;
      const shown = new Set(view.conversations.map((c) => c.id));
      if (pinned && pinsFull(record, id, shown)) return void toast(pick(chatMessages, lang).limits.pinsFull(PINS_MAX));
      change((current) => pinConversation(current, id, pinned, new Date().toISOString(), shown));
      sendChange(scope, { type: "pin", conversationId: id, pinned });
    },
    /**
     * C7 第 2 块: a dot in the list until the conversation is opened again. Only this identity's (its team's) list; the
     * other side's 已读 and every unread count stay as they are.
     */
    markUnread(id: string, marked: boolean) {
      if (!view.messages[id]) return;
      const shown = new Set(view.conversations.map((c) => c.id));
      change((current) => markConversationUnread(current, id, marked, new Date().toISOString(), shown));
      sendChange(scope, { type: "unreadMark", conversationId: id, marked });
    },
    send(id: string, text: string) {
      // Over the server's limit it would show as sent and then be dropped there (#259): not sent at all.
      if (!view.messages[id] || !text.trim() || text.length > MESSAGE_MAX) return;
      change((current) => addSentMessage(current, id, text, new Date().toISOString()));
      sendChange(scope, { type: "send", conversationId: id, text });
    },
    /**
     * #379: the job seeker sends their 中英文简历 into a chat with a business (`employer:` ids; never a demo chat). It
     * shows as its card at once; the server keeps the page as sent.
     */
    sendResume(id: string, resume: ResumeDoc) {
      if (!view.messages[id] || isEmployer || !id.startsWith("employer:")) return;
      const card = { id: 0, name: resume.zh.name, contact: contactKeys(resume.contact) };
      const text = pick(chatMessages, lang).resumeCard.text(card.name);
      change((current) => addSentResume(current, id, card, text, new Date().toISOString()));
      sendChange(scope, { type: "resume", conversationId: id, resume });
    },
    requestInfo(id: string, kind: ExchangeKind, payload: ExchangePayload) {
      if (!view.messages[id]) return;
      change((current) => addExchangeRequest(current, demo, id, kind, payload, crypto.randomUUID()));
      sendChange(scope, { type: "request", conversationId: id, kind, payload });
    },
    respondInfo(
      id: string,
      exchangeId: string,
      status: "accepted" | "rejected" | "cancelled",
      payload?: ExchangePayload,
    ) {
      if (!view.messages[id]) return;
      change((current) => answerExchange(current, demo, id, exchangeId, status, payload));
      sendChange(scope, { type: "answer", conversationId: id, exchangeId, status, payload });
    },
    reportConversation(id: string, reason: ChatReportReason, note: string, messageIndex?: number) {
      const conversation = view.conversations.find((item) => item.id === id);
      if (!conversation) return false;
      const thread = view.messages[id];
      if (messageIndex !== undefined && thread[messageIndex]?.from !== "them") return false;
      const report = parseChatReport({
        id: crypto.randomUUID(),
        conversationId: id,
        targetName: conversation.person,
        targetRole: isEmployer ? "seeker" : "employer",
        reason,
        note: note.trim(),
        evidence: messageIndex !== undefined ? [thread[messageIndex]] : thread.slice(-100),
        createdAt: new Date().toISOString(),
        ...(messageIndex !== undefined ? { messageIndex } : {}),
      });
      if (!report) return false;
      const saved = change((current) => addReport(current, report)) === true;
      if (saved) sendChange(scope, { type: "report", conversationId: id, reason, note, messageIndex });
      return saved;
    },
    /** The business chats with a 推荐人才 candidate about one of its jobs; resolves to the conversation's id. */
    async openCandidateChat(candidate: Candidate, job: Job): Promise<string | null> {
      if (!session || !isEmployer || job.employerId !== session.employerId || !candidate.resume.discoverable)
        return null;
      return openOnServer(
        scope,
        { kind: "candidate", jobId: job.id, candidateId: candidate.id, name: candidate.name },
        lang,
      );
    },
    /** #84: the business chats with someone who applied for one of its jobs; resolves to the conversation's id. */
    async openApplicantChat(applicant: { id: string }, job: Pick<Job, "id" | "employerId">): Promise<string | null> {
      if (!session || !isEmployer || job.employerId !== session.employerId) return null;
      return openOnServer(scope, { kind: "applicant", jobId: job.id, applicationId: applicant.id }, lang);
    },
    openEmployerChat(
      employer: Pick<Employer, "id" | "name">,
      job: Pick<Job, "id" | "employerId" | "titleZh" | "status" | "expiresAt">,
    ) {
      if (
        !session ||
        isEmployer ||
        session.employerId === employer.id ||
        job.employerId !== employer.id ||
        job.status !== "active" ||
        Date.parse(job.expiresAt) <= Date.now()
      )
        return null;
      const id = `employer:${employer.id}:${job.id}`;
      change((current) =>
        openConversation(current, {
          id,
          person: employer.name,
          title: job.titleZh,
          time: JUST_NOW,
          avatar: employer.name.slice(0, 1),
          job: job.id,
          employerId: employer.id,
        }),
      );
      sendChange(scope, { type: "open", conversation: { kind: "employer", jobId: job.id } });
      return id;
    },
  };
}
