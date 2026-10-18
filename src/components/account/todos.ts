// The workspace (/workspace) lists only what needs doing, most urgent first (Round 11, C3):
// someone waiting for your consent, then unread chats, then interviews (#103), then new applications (#84), then jobs about to close (#69)
// or under review, then the profile.
import type { Exchange } from "@/lib/chat-consent";
import type { Job } from "@/lib/types";
import { closingReminders } from "@/components/employer/job-reminders";
import type { RejectReason, RequestStatus } from "@/components/employer/verification";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { accountMessages } from "@/i18n/messages/account";
import { chatMessages } from "@/i18n/messages/chat";
import { employerVerifyMessages } from "@/i18n/messages/employer-verify";

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
  /** The page's language (Round 20); Chinese when left out. */
  lang?: Lang;
};

const CLOSING_HREF = "/employer/jobs?tab=ending";
const conversationHref = (id: string) => `/messages?conversation=${encodeURIComponent(id)}`;

export function workspaceTodos(input: TodoInput): Todo[] {
  const lang = input.lang ?? DEFAULT_LANG;
  const t = pick(accountMessages, lang).todos;
  const todos: Todo[] = [];

  for (const conversation of input.conversations) {
    for (const exchange of input.exchanges[conversation.id] ?? []) {
      if (exchange.from !== "them" || exchange.status !== "pending") continue;
      todos.push({
        id: `exchange:${exchange.id}`,
        title: t.exchangeAsked(conversation.person, pick(chatMessages, lang).exchangeKinds[exchange.kind]),
        detail: t.exchangeAskedDetail,
        href: conversationHref(conversation.id),
      });
    }
  }

  for (const conversation of input.conversations) {
    const count = input.unread[conversation.id] ?? 0;
    if (!count) continue;
    todos.push({
      id: `unread:${conversation.id}`,
      title: t.newMessages(conversation.person, count),
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
        title: t.newApplications(count),
        detail: t.jobTitle(job.titleZh),
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
        title: t.jobInReview(job.titleZh),
        detail: t.jobInReviewDetail,
        href: "/employer/jobs",
      });
    }
  }

  // 企业验证 (#78): a rejection needs the employer; a pending application only says it is in hand.
  if (input.isEmployer && input.verification?.status === "rejected") {
    const reason = input.verification.rejectReason;
    todos.push({
      id: "verification",
      title: t.verificationRejected,
      detail: t.verificationRejectedDetail(reason ? pick(employerVerifyMessages, lang).rejectReasons[reason] : null),
      href: "/employer/verify",
    });
  } else if (input.isEmployer && input.verification?.status === "pending") {
    todos.push({
      id: "verification",
      title: t.verificationInReview,
      detail: t.verificationInReviewDetail,
      href: "/employer/verify",
    });
  }

  if (input.profileMissing.count > 0) {
    todos.push({
      id: "profile",
      title: t.profileMissing(input.isEmployer, input.profileMissing.count),
      detail: t.missingItems(input.profileMissing.labels.slice(0, 3), input.profileMissing.count > 3),
      href: "/profile",
    });
  }

  return todos;
}
