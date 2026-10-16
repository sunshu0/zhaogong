// The workspace (/workspace) lists only what needs doing, most urgent first (Round 11, C3):
// someone waiting for your consent, then unread chats, then jobs about to close (#69) or under review, then the
// profile.
import type { Exchange } from "@/lib/chat-consent";
import { EXCHANGE_LABELS } from "@/lib/chat-consent";
import type { Job } from "@/lib/types";
import { closingReminders } from "@/components/employer/job-reminders";

export type Todo = { id: string; title: string; detail?: string; href: string };

export type TodoInput = {
  isEmployer: boolean;
  conversations: { id: string; person: string }[];
  unread: Record<string, number>;
  exchanges: Record<string, Exchange[]>;
  /** The employer's own jobs, once loaded. */
  jobs?: Pick<Job, "id" | "titleZh" | "status" | "expiresAt">[];
  now: number;
  profileMissing: { count: number; labels: string[] };
};

const CLOSING_HREF = "/employer/jobs?tab=ending";
const conversationHref = (id: string) => `/messages?conversation=${encodeURIComponent(id)}`;

export function workspaceTodos(input: TodoInput): Todo[] {
  const todos: Todo[] = [];

  for (const conversation of input.conversations) {
    for (const exchange of input.exchanges[conversation.id] ?? []) {
      if (exchange.from !== "them" || exchange.status !== "pending") continue;
      todos.push({
        id: `exchange:${exchange.id}`,
        title: `${conversation.person}想和你交换${EXCHANGE_LABELS[exchange.kind]}`,
        detail: "等你同意或拒绝",
        href: conversationHref(conversation.id),
      });
    }
  }

  for (const conversation of input.conversations) {
    const count = input.unread[conversation.id] ?? 0;
    if (!count) continue;
    todos.push({
      id: `unread:${conversation.id}`,
      title: `${conversation.person}发来 ${count} 条新消息`,
      href: conversationHref(conversation.id),
    });
  }

  if (input.isEmployer && input.jobs) {
    // The same reminders as 通知 has: from 3 days before closing, and while a job that ran out can be renewed.
    for (const reminder of closingReminders(input.jobs, input.now)) {
      todos.push({ id: reminder.id, title: reminder.title, detail: reminder.detail, href: CLOSING_HREF });
    }
    for (const job of input.jobs.filter((job) => job.status === "pending_review")) {
      todos.push({
        id: `review:${job.id}`,
        title: `「${job.titleZh}」审核中`,
        detail: "通过后会出现在职位列表，不需要你操作",
        href: "/employer/jobs",
      });
    }
  }

  if (input.profileMissing.count > 0) {
    todos.push({
      id: "profile",
      title: `${input.isEmployer ? "企业资料" : "资料"}还差 ${input.profileMissing.count} 项`,
      detail: `${input.profileMissing.labels.slice(0, 3).join("、")}${input.profileMissing.count > 3 ? " 等" : ""}`,
      href: "/profile",
    });
  }

  return todos;
}
