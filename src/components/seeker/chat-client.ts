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
  const candidateId =
    conversation.candidateId ??
    (conversation.id.startsWith("recommend:") ? conversation.id.split(":")[1] : conversation.id);
  return candidateId ? `/candidates/${encodeURIComponent(candidateId)}` : undefined;
}

export const CHAT_KEY = "zhaogong:chat-demo";
export function parseChats(raw: string | null): Record<string, ChatRecord> {
  return parseStoredChats(raw, chatDemo);
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
// load. Records from before #10 that only this browser has are handed to the server once.
const syncedScopes = new Set<string>();

function syncScope(scope: string) {
  if (syncedScopes.has(scope)) return;
  syncedScopes.add(scope);
  (async () => {
    const server = await myChat();
    if (!server || server.scope !== scope) return syncedScopes.delete(scope); // signed out, or another identity
    const local = store.update((storage) => parseChats(storage.getItem(CHAT_KEY))[scope]);
    keep(isEmpty(server.record) && local && !isEmpty(local) ? await importMyChat(local) : server);
  })().catch(() => syncedScopes.delete(scope));
}

/** Sends one change to the server and keeps its answer (the browser has already shown the change). */
function sendChange(scope: string, change: ChatChange) {
  changeMyChat(change)
    .then(keep)
    .catch(() => {});
}

export function useChat() {
  const session = useSession();
  const accounts = store.useValue();
  const scope = identityScope(session);
  const isEmployer = session?.activeRole === "employer";
  const demo = chatDemo(isEmployer);
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
    openCandidateChat(candidate: Candidate, job: Job) {
      if (!session || !isEmployer || job.employerId !== session.employerId || !candidate.resume.discoverable)
        return null;
      const id = `recommend:${candidate.id}:${job.id}`;
      change((current) =>
        openConversation(current, {
          id,
          person: candidate.name,
          title: job.titleZh,
          time: "刚刚",
          avatar: candidate.name.slice(0, 1),
          job: job.id,
          candidateId: candidate.id,
        }),
      );
      sendChange(scope, {
        type: "open",
        conversation: { kind: "candidate", jobId: job.id, candidateId: candidate.id, name: candidate.name },
      });
      return id;
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
