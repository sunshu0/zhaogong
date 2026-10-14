"use client";

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { useChat } from "@/components/seeker/chat-client";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { useNotifications } from "@/components/seeker/hub-client";
import { useSession } from "@/components/seeker/session-client";
import { workspaceTitle } from "@/components/seeker/workspace";

export function WorkspaceDashboard() {
  const session = useSession();
  const isEmployer = session?.activeRole === "employer";
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-medium text-brand">找工 · 工作台</p>
        <h1 className="mt-1 text-2xl font-semibold">{workspaceTitle(isEmployer)}</h1>
        {isEmployer && <p className="mt-1 text-sm text-muted">{session.employerName}</p>}
      </header>
      {isEmployer && <CandidatesLink />}
      <SummaryCards isEmployer={isEmployer} />
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <RecentChat />
        <RecordLinks isEmployer={isEmployer} />
      </section>
      {session && <p className="text-xs text-muted">当前账号：{session.email} · 演示数据</p>}
    </div>
  );
}

function CandidatesLink() {
  return (
    <Link href="/employer/candidates" className="flex items-center justify-between gap-3 border-y border-border py-4">
      <div>
        <p className="font-semibold text-brand">推荐人才</p>
        <p className="mt-1 text-sm text-muted">查看与你的招聘要求匹配的求职者</p>
      </div>
      <span aria-hidden="true" className="text-brand">
        →
      </span>
    </Link>
  );
}

function SummaryCards({ isEmployer }: { isEmployer: boolean }) {
  const { totalUnread } = useChat();
  const { unread: notificationUnread } = useNotifications();
  return (
    <section className="grid gap-3 sm:grid-cols-3" aria-label="工作台摘要">
      <Link href="/messages" className="rounded-lg border border-brand/30 bg-brand-soft p-4 hover:border-brand">
        <p className="flex items-center gap-2 font-semibold text-brand">
          <MessageSquare aria-hidden="true" className="size-5" />
          聊天 <UnreadBadge count={totalUnread} />
        </p>
        <p className="mt-2 text-sm text-muted">{totalUnread ? `${totalUnread} 条未读消息` : "暂无未读消息"}</p>
      </Link>
      <Link href="/notifications" className="rounded-lg border border-border bg-surface p-4 hover:border-brand/40">
        <p className="flex items-center gap-2 font-medium text-brand">
          通知 <UnreadBadge count={notificationUnread} />
        </p>
        <p className="mt-2 text-sm text-muted">{isEmployer ? "应聘与招聘动态" : "职位与简历动态"}</p>
      </Link>
      <Link href="/profile" className="rounded-lg border border-border bg-surface p-4 hover:border-brand/40">
        <p className="font-medium text-brand">{isEmployer ? "企业主页" : "我的主页"}</p>
        <p className="mt-2 text-sm text-muted">{isEmployer ? "企业资料与招聘联系人" : "个人资料"}</p>
      </Link>
    </section>
  );
}

function RecentChat() {
  const { unread, messages, conversations } = useChat();
  const recent = conversations[0];
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">最近聊天</h2>
        <Link href="/messages" className="text-xs text-brand underline underline-offset-2">
          查看全部
        </Link>
      </div>
      <Link href="/messages" className="mt-3 flex items-center gap-3 border-t border-border pt-3">
        <span
          aria-hidden="true"
          className="flex shrink-0 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand size-9 text-sm"
        >
          {recent.avatar.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{recent.person}</p>
          <p className="mt-1 truncate text-xs text-muted">{messages[recent.id].at(-1)?.text}</p>
        </div>
        <UnreadBadge count={unread[recent.id]} />
      </Link>
    </div>
  );
}

function RecordLinks({ isEmployer }: { isEmployer: boolean }) {
  return (
    <div className="space-y-3 border-l border-border pl-4">
      <h2 className="font-medium">{isEmployer ? "招聘管理" : "求职资料"}</h2>
      <Link href="/profile" className="block text-sm text-brand underline">
        {isEmployer ? "完善企业主页" : "完善我的主页"}
      </Link>
      <Link href="/me" className="block text-sm text-brand underline">
        {isEmployer ? "查看招聘记录" : "查看求职记录"}
      </Link>
      {isEmployer && (
        <Link
          href="/employer/post"
          className="inline-flex rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white"
        >
          发布新职位
        </Link>
      )}
    </div>
  );
}
