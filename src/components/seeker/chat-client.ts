"use client";

import { useEffect, useMemo } from "react";
import { changeMyChat, importMyChat, myChat, type ChatChange, type ChatSnapshot } from "@/app/messages/actions";
import { createLocalStore } from "@/components/seeker/local-store";
import { useSession } from "@/components/seeker/session-client";
import { identityScope, stringifyStoredIdentities } from "@/components/seeker/identity-scope";
import type { Candidate } from "@/lib/candidate-matching";
import type { Employer, Job } from "@/lib/types";
import type { ExchangeKind, ExchangePayload } from "@/lib/chat-consent";
import { parseChatReport, type ChatReportReason } from "@/lib/chat-report";
import { chatDemo } from "@/components/seeker/chat-demo";
import { isDemoAccount } from "@/lib/demo-accounts";
import { addToOutbox, outboxFor, removeFromOutbox, type OutboxItem } from "@/components/seeker/chat-outbox";
import {
  EMPTY_CHAT,
  addExchangeRequest,
  addReport,
  addSentMessage,
  answerExchange,
  chatView,
  markConversationRead,
  openConversation,
  parseChats as parseStoredChats,
  type ChatRecord,
  type Conversation,
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

/**
 * Keeps the server's answer as the copy of the identity it is for. The cookie decides which identity the server
 * answers for; during a switch or sign-in that may not be the one asked about, so the answer names its scope.
 */
function keep(snapshot: ChatSnapshot | null) {
  if (!snapshot) return;
  store.update((storage) => {
    const current = parseChats(storage.getItem(CHAT_KEY));
    storage.setItem(CHAT_KEY, stringifyStoredIdentities({ ...current, [snapshot.scope]: snapshot.record }));
  });
}

const isEmpty = (record: ChatRecord) =>
  !Object.keys(record.added).length &&
  !Object.keys(record.readAt).length &&
  !record.extra.length &&
  !Object.keys(record.exchanges).length &&
  !record.reports.length;

// The server's records are the truth (#10); this browser's copy is a cache, refreshed once per identity per page
// load, after sending what the outbox still holds. Records from before #10 that only this browser has are handed
// to the server once.
const syncedScopes = new Set<string>();

function syncScope(scope: string) {
  if (syncedScopes.has(scope)) return;
  syncedScopes.add(scope);
  (async () => {
    await sendWaitingChanges(scope);
    const server = await myChat();
    if (!server || server.scope !== scope) return syncedScopes.delete(scope); // signed out, or another identity
    const local = store.update((storage) => parseChats(storage.getItem(CHAT_KEY))[scope]);
    keep(isEmpty(server.record) && local && !isEmpty(local) ? await importMyChat(local) : server);
  })().catch(() => syncedScopes.delete(scope));
}

/**
 * Sends one change to the server and keeps its answer (the browser has already shown the change). It waits in the
 * outbox until the server has it, so leaving the page first does not lose it.
 */
function sendChange(scope: string, change: ChatChange) {
  const item: OutboxItem = { id: crypto.randomUUID(), scope, change };
  addToOutbox(localStorage, item);
  deliver(item).catch(() => {});
}

/**
 * Sends what the outbox still holds for one identity, oldest first. A change that cannot be sent now stays for the
 * next page load. Pages that read chat-derived facts from the server (收藏和进度) call it first.
 */
export async function sendWaitingChanges(scope: string): Promise<void> {
  for (const item of outboxFor(localStorage, scope)) if (!(await deliver(item).catch(() => false))) break;
}

/**
 * Reads the identity's chat again, for messages the other side sent since (#110: there is no push). What this
 * browser has not sent yet goes first; an answer that comes back while more is waiting is not kept, so a message
 * just shown does not blink away.
 */
async function refreshChat(scope: string): Promise<void> {
  await sendWaitingChanges(scope);
  const server = await myChat();
  if (server?.scope === scope && !outboxFor(localStorage, scope).length) keep(server);
}

/** How often an open chat page reads again while it is in front. */
export const CHAT_REFRESH_MS = 10_000;

/** Keeps the signed-in identity's chat fresh while the page is in front, and when it comes back to it. */
export function useChatRefresh(): void {
  const session = useSession();
  const scope = identityScope(session);
  const signedIn = Boolean(session);
  useEffect(() => {
    if (!signedIn) return;
    const refresh = () => {
      if (document.visibilityState === "visible") refreshChat(scope).catch(() => {});
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
async function openOnServer(scope: string, conversation: Extract<ChatChange, { type: "open" }>["conversation"]) {
  const snapshot = await changeMyChat({ type: "open", conversation }).catch(() => null);
  if (snapshot?.scope !== scope) return null;
  keep(snapshot);
  return snapshot.opened ?? null;
}

/** True once the server has the change for the identity it was made in; it then leaves the outbox. */
async function deliver(item: OutboxItem): Promise<boolean> {
  const snapshot = await changeMyChat(item.change, { id: item.id, scope: item.scope });
  keep(snapshot);
  if (snapshot?.scope !== item.scope) return false;
  removeFromOutbox(localStorage, item.id);
  return true;
}

export function useChat() {
  const session = useSession();
  const accounts = store.useValue();
  const scope = identityScope(session);
  const isEmployer = session?.activeRole === "employer";
  const demo = chatDemo(isEmployer, isDemoAccount(session?.email));
  const record = accounts[scope] ?? EMPTY_CHAT;
  // Memoized: pages keep `messages` and the like in effect dependencies.
  const view = useMemo(() => chatView(record, demo), [record, demo]);
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
    totalUnread: session ? Object.values(view.unread).reduce((total, count) => total + count, 0) : 0,
    markRead(id: string) {
      if (!view.messages[id]) return;
      if (!view.unread[id] && view.messages[id].every((message) => message.from === "me" || message.readAt)) return;
      change((current) => markConversationRead(current, id, new Date().toISOString()));
      sendChange(scope, { type: "read", conversationId: id });
    },
    send(id: string, text: string) {
      if (!view.messages[id] || !text.trim()) return;
      change((current) => addSentMessage(current, id, text, new Date().toISOString()));
      sendChange(scope, { type: "send", conversationId: id, text });
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
      return openOnServer(scope, {
        kind: "candidate",
        jobId: job.id,
        candidateId: candidate.id,
        name: candidate.name,
      });
    },
    /** #84: the business chats with someone who applied for one of its jobs; resolves to the conversation's id. */
    async openApplicantChat(applicant: { id: string }, job: Pick<Job, "id" | "employerId">): Promise<string | null> {
      if (!session || !isEmployer || job.employerId !== session.employerId) return null;
      return openOnServer(scope, { kind: "applicant", jobId: job.id, applicationId: applicant.id });
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
          time: "刚刚",
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
