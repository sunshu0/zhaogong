// The workspace (/workspace) lists only what needs doing, most urgent first (Round 11, C3):
// someone waiting for your consent, then unread chats, then interviews (#103), then new applications (#84), then jobs about to close (#69)
// or under review, then the profile.
import type { Exchange } from "@/lib/chat-consent";
import { EXCHANGE_LABELS } from "@/lib/chat-consent";
import type { Job } from "@/lib/types";
import { closingReminders } from "@/components/employer/job-reminders";
import { REJECT_REASONS, type RejectReason, type RequestStatus } from "@/components/employer/verification";

export type Todo = { id: string; title: string; detail?: string; href: string };

export type TodoInput = {
  isEmployer: boolean;
  conversations: { id: string; person: string }[];
  unread: Record<string, number>;
  exchanges: Record<string, Exchange[]>;
  /** The employer's own jobs, once loaded. */
  jobs?: Pick<Job, "id" | "titleZh" | "status" | "expiresAt">[];
  /** 待确认的面试 and 今天 / 明天的面试 (#103), made on the server for either side, once loaded. */
  interviews?: Todo[];
  /** Applications the business has not looked at yet, by job (#84), once loaded. */
  unseenApplications?: Record<string, number>;
  now: number;
  profileMissing: { count: number; labels: string[] };
  /** The business's latest 企业验证 application (#78), once loaded. */
  verification?: { status: RequestStatus; rejectReason?: RejectReason | null } | null;
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

  todos.push(...(input.interviews ?? []));

  if (input.isEmployer && input.jobs) {
    for (const job of input.jobs) {
      const count = input.unseenApplications?.[job.id] ?? 0;
      if (!count) continue;
      todos.push({
        id: `applications:${job.id}`,
        title: `${count} 个新申请`,
        detail: `「${job.titleZh}」`,
        href: `/employer/jobs/${encodeURIComponent(job.id)}/applicants`,
      });
    }
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

  // 企业验证 (#78): a rejection needs the employer; a pending application only says it is in hand.
  if (input.isEmployer && input.verification?.status === "rejected") {
    const reason = input.verification.rejectReason;
    todos.push({
      id: "verification",
      title: "企业验证没有通过",
      detail: `${reason ? `${REJECT_REASONS[reason]}，` : ""}改好资料重新提交`,
      href: "/employer/verify",
    });
  } else if (input.isEmployer && input.verification?.status === "pending") {
    todos.push({
      id: "verification",
      title: "企业验证审核中",
      detail: "审核员核对后会通知你，不需要你操作",
      href: "/employer/verify",
    });
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
