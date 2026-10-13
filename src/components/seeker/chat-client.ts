"use client";

import { createLocalStore } from "@/components/seeker/local-store";
import { useSession } from "@/components/seeker/session-client";
import { identityScope, parseIdentityMap } from "@/components/seeker/identity-scope";
import type { Candidate } from "@/lib/candidate-matching";
import type { Employer, Job } from "@/lib/types";
import {
  parseExchange,
  requestExchange,
  respondExchange,
  type Exchange,
  type ExchangeKind,
  type ExchangePayload,
} from "@/lib/chat-consent";
import { parseChatReport, type ChatReport, type ChatReportReason } from "@/lib/chat-report";
import { demoExchangeRequests } from "@/mock/chat-exchanges";
import { validTimestamp } from "@/lib/chat-activity";

export type Message = { from: "me" | "them"; text: string; time: string; sentAt?: string; readAt?: string };
export const CONVERSATIONS = [
  {
    id: "north-tea",
    person: "北岸早茶酒家",
    title: "前厅服务员",
    time: "10:42",
    avatar: "北",
    job: "j3",
    employerId: "e2",
  },
  {
    id: "mt-eden",
    person: "Mt Eden 餐馆",
    title: "前厅服务员",
    time: "昨天",
    avatar: "M",
    job: "j1",
    employerId: "e1",
  },
  { id: "clean-home", person: "洁净家政", title: "清洁员", time: "周一", avatar: "洁", job: "j10", employerId: "e6" },
];
const EMPLOYER_CONVERSATIONS = [
  { id: "candidate-lin", person: "林晓", title: "前厅服务员", time: "10:42", avatar: "林", job: null },
  { id: "candidate-chen", person: "陈雨", title: "前厅服务员", time: "昨天", avatar: "陈", job: null },
  { id: "candidate-wang", person: "王宁", title: "厨房帮工", time: "周一", avatar: "王", job: null },
];

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

export function conversationProfileHref(conversation: Conversation, isEmployer: boolean): string | undefined {
  if (!isEmployer)
    return conversation.employerId ? `/employers/${encodeURIComponent(conversation.employerId)}` : undefined;
  const candidateId =
    conversation.candidateId ??
    (conversation.id.startsWith("recommend:") ? conversation.id.split(":")[1] : conversation.id);
  return candidateId ? `/candidates/${encodeURIComponent(candidateId)}` : undefined;
}
type ChatState = {
  messages: Record<string, Message[]>;
  unread: Record<string, number>;
  extra?: Conversation[];
  exchanges?: Record<string, Exchange[]>;
  reports?: ChatReport[];
};
const INITIAL: ChatState = {
  unread: { "north-tea": 2, "mt-eden": 1, "clean-home": 0 },
  messages: {
    "north-tea": [
      { from: "them", text: "你好，你的时间安排怎么样？", time: "10:35" },
      {
        from: "me",
        text: "你好！我周一到周六下午都可以，普通话和英语都能沟通。",
        time: "10:39",
        readAt: "2026-10-13T00:00:00Z",
      },
      { from: "them", text: "方便今天下午聊一下吗？也可以先交换联系方式。", time: "10:42" },
    ],
    "mt-eden": [
      { from: "them", text: "你好，感谢你对我们职位感兴趣。", time: "昨天" },
      { from: "me", text: "你好，我想了解一下具体的工作时间。", time: "昨天", readAt: "2026-10-12T00:00:00Z" },
      { from: "them", text: "我们可以安排面谈。", time: "昨天" },
    ],
    "clean-home": [{ from: "them", text: "已查看你的简历，有合适的班次会联系你。", time: "周一" }],
  },
};
const EMPLOYER_INITIAL: ChatState = {
  unread: { "candidate-lin": 1, "candidate-chen": 3, "candidate-wang": 0 },
  messages: {
    "candidate-lin": [
      { from: "me", text: "你好，方便今天下午到店面谈吗？", time: "10:35", readAt: "2026-10-13T00:00:00Z" },
      { from: "them", text: "您好，我有前厅服务经验，今天下午可以到店面谈。", time: "10:42" },
    ],
    "candidate-chen": [{ from: "them", text: "您好，我想应聘前厅服务员，可以先发简历给您吗？", time: "昨天" }],
    "candidate-wang": [{ from: "them", text: "谢谢，收到工作地址了。", time: "周一" }],
  },
};

export const CHAT_KEY = "zhaogong:chat-demo";
export function parseChats(raw: string | null): Record<string, ChatState> {
  return parseIdentityMap(raw, (value) => {
    if (!value || typeof value !== "object") return undefined;
    const { messages, unread, extra, exchanges, reports } = value as ChatState;
    if (!messages || !unread) return undefined;
    const valid = [CONVERSATIONS, EMPLOYER_CONVERSATIONS].some((conversations) =>
      conversations.every(
        ({ id }) =>
          Array.isArray(messages[id]) &&
          messages[id].every(
            (message: Message) =>
              message &&
              (message.from === "me" || message.from === "them") &&
              typeof message.text === "string" &&
              typeof message.time === "string",
          ) &&
          Number.isInteger(unread[id]) &&
          unread[id] >= 0,
      ),
    );
    const extrasValid =
      extra === undefined ||
      (Array.isArray(extra) &&
        extra.every(
          (item) =>
            item &&
            [item.id, item.person, item.title, item.time, item.avatar, item.job].every(
              (field) => typeof field === "string",
            ) &&
            (item.id.startsWith("recommend:") || item.id.startsWith("employer:")) &&
            (item.employerId === undefined || typeof item.employerId === "string") &&
            (item.candidateId === undefined || typeof item.candidateId === "string") &&
            Array.isArray(messages[item.id]) &&
            messages[item.id].every(
              (message) =>
                message &&
                (message.from === "me" || message.from === "them") &&
                typeof message.text === "string" &&
                typeof message.time === "string",
            ) &&
            Number.isInteger(unread[item.id]) &&
            unread[item.id] >= 0,
        ));
    if (!valid || !extrasValid) return undefined;
    const ids = [...CONVERSATIONS, ...EMPLOYER_CONVERSATIONS, ...(extra ?? [])]
      .map((item) => item.id)
      .filter((id) => Array.isArray(messages[id]));
    const parsedExchanges =
      exchanges && typeof exchanges === "object" && !Array.isArray(exchanges)
        ? Object.fromEntries(
            Object.entries(exchanges)
              .filter(([id]) => ids.includes(id))
              .map(([id, items]) => [
                id,
                Array.isArray(items)
                  ? items.flatMap((item) => {
                      const parsed = parseExchange(item);
                      return parsed ? [parsed] : [];
                    })
                  : [],
              ]),
          )
        : {};
    return {
      messages: Object.fromEntries(
        ids.map((id) => [
          id,
          messages[id].map(({ sentAt, readAt, ...message }) => ({
            ...message,
            ...(validTimestamp(sentAt) ? { sentAt } : {}),
            ...(validTimestamp(readAt) ? { readAt } : {}),
          })),
        ]),
      ),
      unread: Object.fromEntries(ids.map((id) => [id, unread[id]])),
      ...(extra ? { extra } : {}),
      ...(exchanges !== undefined ? { exchanges: parsedExchanges } : {}),
      ...(reports !== undefined
        ? {
            reports: Array.isArray(reports)
              ? reports.flatMap((item) => {
                  const parsed = parseChatReport(item);
                  return parsed && ids.includes(parsed.conversationId) ? [parsed] : [];
                })
              : [],
          }
        : {}),
    };
  });
}
const store = createLocalStore(CHAT_KEY, parseChats);
const SEEKER_EXCHANGES = demoExchangeRequests(false);
const EMPLOYER_EXCHANGES = demoExchangeRequests(true);

export function useChat() {
  const session = useSession();
  const accounts = store.useValue();
  const email = session?.email;
  const scope = identityScope(session);
  const isEmployer = session?.activeRole === "employer";
  const initial = isEmployer ? EMPLOYER_INITIAL : INITIAL;
  // Old chats belong to the seeker identity, never to the business identity.
  const state = accounts[scope] ?? (!isEmployer && email ? accounts[email] : undefined) ?? initial;
  const initialExchanges = isEmployer ? EMPLOYER_EXCHANGES : SEEKER_EXCHANGES;
  const exchanges = state.exchanges ?? initialExchanges;

  function change(update: (current: ChatState) => ChatState) {
    if (!email) return;
    return store.update((storage) => {
      const current = parseChats(storage.getItem(CHAT_KEY));
      storage.setItem(
        CHAT_KEY,
        JSON.stringify({
          ...current,
          [scope]: update(current[scope] ?? (!isEmployer ? current[email] : undefined) ?? initial),
        }),
      );
      return true;
    });
  }

  return {
    ...state,
    exchanges,
    reports: state.reports ?? [],
    conversations: [...(state.extra ?? []), ...(isEmployer ? EMPLOYER_CONVERSATIONS : CONVERSATIONS)],
    totalUnread: session ? Object.values(state.unread).reduce((total, count) => total + count, 0) : 0,
    markRead(id: string) {
      if (!state.messages[id]) return;
      if (!state.unread[id] && state.messages[id].every((message) => message.from === "me" || message.readAt)) return;
      const readAt = new Date().toISOString();
      change((current) => ({
        ...current,
        unread: { ...current.unread, [id]: 0 },
        messages: {
          ...current.messages,
          [id]: current.messages[id].map((message) =>
            message.from === "them" && !message.readAt ? { ...message, readAt } : message,
          ),
        },
      }));
    },
    send(id: string, text: string) {
      if (!state.messages[id] || !text.trim()) return;
      change((current) => ({
        ...current,
        messages: {
          ...current.messages,
          [id]: [...current.messages[id], { from: "me", text, time: "刚刚", sentAt: new Date().toISOString() }],
        },
      }));
    },
    requestInfo(id: string, kind: ExchangeKind, payload: ExchangePayload) {
      if (!state.messages[id]) return;
      change((current) => {
        const all = current.exchanges ?? initialExchanges;
        return {
          ...current,
          exchanges: { ...all, [id]: requestExchange(all[id] ?? [], kind, payload, crypto.randomUUID()) },
        };
      });
    },
    respondInfo(
      id: string,
      exchangeId: string,
      status: "accepted" | "rejected" | "cancelled",
      payload?: ExchangePayload,
    ) {
      if (!state.messages[id]) return;
      change((current) => {
        const all = current.exchanges ?? initialExchanges;
        return {
          ...current,
          exchanges: {
            ...all,
            [id]: (all[id] ?? []).map((item) =>
              item.id === exchangeId ? respondExchange(item, "me", status, payload) : item,
            ),
          },
        };
      });
    },
    reportConversation(id: string, reason: ChatReportReason, note: string, messageIndex?: number) {
      const conversation = [...(state.extra ?? []), ...(isEmployer ? EMPLOYER_CONVERSATIONS : CONVERSATIONS)].find(
        (item) => item.id === id,
      );
      if (!conversation) return false;
      const thread = state.messages[id];
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
      return change((current) => ({ ...current, reports: [...(current.reports ?? []), report] })) === true;
    },
    openCandidateChat(candidate: Candidate, job: Job) {
      if (!session || !isEmployer || job.employerId !== session.employerId || !candidate.resume.discoverable)
        return null;
      const id = `recommend:${candidate.id}:${job.id}`;
      change((current) =>
        current.extra?.some((item) => item.id === id)
          ? current
          : {
              ...current,
              extra: [
                {
                  id,
                  person: candidate.name,
                  title: job.titleZh,
                  time: "刚刚",
                  avatar: candidate.name.slice(0, 1),
                  job: job.id,
                  candidateId: candidate.id,
                },
                ...(current.extra ?? []),
              ],
              messages: { ...current.messages, [id]: [] },
              unread: { ...current.unread, [id]: 0 },
            },
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
        current.extra?.some((item) => item.id === id)
          ? current
          : {
              ...current,
              extra: [
                {
                  id,
                  person: employer.name,
                  title: job.titleZh,
                  time: "刚刚",
                  avatar: employer.name.slice(0, 1),
                  job: job.id,
                  employerId: employer.id,
                },
                ...(current.extra ?? []),
              ],
              messages: { ...current.messages, [id]: [] },
              unread: { ...current.unread, [id]: 0 },
            },
      );
      return id;
    },
  };
}
