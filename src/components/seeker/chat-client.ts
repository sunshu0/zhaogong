"use client";

import { useMemo } from "react";
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

export function useChat() {
  const session = useSession();
  const accounts = store.useValue();
  const scope = identityScope(session);
  const isEmployer = session?.activeRole === "employer";
  const demo = chatDemo(isEmployer);
  const record = accounts[scope] ?? EMPTY_CHAT;
  // Memoized: pages keep `messages` and the like in effect dependencies.
  const view = useMemo(() => chatView(record, demo), [record, demo]);

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
    },
    send(id: string, text: string) {
      if (!view.messages[id] || !text.trim()) return;
      change((current) => addSentMessage(current, id, text, new Date().toISOString()));
    },
    requestInfo(id: string, kind: ExchangeKind, payload: ExchangePayload) {
      if (!view.messages[id]) return;
      change((current) => addExchangeRequest(current, demo, id, kind, payload, crypto.randomUUID()));
    },
    respondInfo(
      id: string,
      exchangeId: string,
      status: "accepted" | "rejected" | "cancelled",
      payload?: ExchangePayload,
    ) {
      if (!view.messages[id]) return;
      change((current) => answerExchange(current, demo, id, exchangeId, status, payload));
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
      return change((current) => addReport(current, report)) === true;
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
      return id;
    },
  };
}
