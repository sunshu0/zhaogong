// The workspace (/workspace) lists only what needs doing, most urgent first (Round 11, C3):
// someone waiting for your consent, then unread chats, then jobs about to end or under review, then the profile.
import type { Exchange } from "@/lib/chat-consent";
import { EXCHANGE_LABELS } from "@/lib/chat-consent";
import type { Job } from "@/lib/types";
import { daysLeft, effectiveStatus } from "@/components/employer/job-status";

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

const EXPIRING_DAYS = 7;
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
    const expiring = input.jobs
      .filter((job) => effectiveStatus(job, input.now) === "active" && daysLeft(job, input.now) <= EXPIRING_DAYS)
      .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
    for (const job of expiring) {
      const days = daysLeft(job, input.now);
      todos.push({
        id: `expiring:${job.id}`,
        title: `「${job.titleZh}」${days <= 1 ? "今天到期" : `${days} 天后到期`}`,
        detail: "还要招人就刷新，招到了就结束招聘",
        href: "/employer/jobs",
      });
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
