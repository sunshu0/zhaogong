"use client";

import Link from "next/link";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { useNotifications } from "@/components/seeker/hub-client";

type NavItem = { href: string; label: string };

/**
 * The workspace sidebar (from 1024 px). Names match the header, the account menu and 我的; 聊天 and 职位管理 are
 * in the header, so they are not repeated here. Phones reach these pages from 我的 in the bottom bar.
 */
function workspaceNav(isEmployer: boolean): NavItem[] {
  return [
    { href: "/workspace", label: "总览" },
    { href: "/notifications", label: "通知" },
    { href: "/profile", label: isEmployer ? "企业主页" : "我的主页" },
    isEmployer ? { href: "/employer/candidates", label: "推荐人才" } : { href: "/me", label: "浏览与举报" },
  ];
}

const ACTIVE = "bg-brand-soft font-medium text-brand";

export function WorkspaceNav({ pathname, isEmployer }: { pathname: string; isEmployer: boolean }) {
  const { unread: notificationUnread } = useNotifications();
  return (
    <nav aria-label="工作台导航" className="mt-3 space-y-1">
      {workspaceNav(isEmployer).map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center justify-between gap-2 rounded-lg px-2.5 text-body ${
              active ? ACTIVE : "hover:bg-background"
            }`}
          >
            {item.label}
            {item.href === "/notifications" && <UnreadBadge count={notificationUnread} />}
          </Link>
        );
      })}
    </nav>
  );
}
