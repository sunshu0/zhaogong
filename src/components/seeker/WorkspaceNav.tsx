"use client";

import Link from "next/link";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { useNotifications } from "@/components/seeker/hub-client";
import { ALERTS_PATH } from "@/components/seeker/job-alerts";
import { ACCOUNT_DATA_PATH } from "@/components/ui/nav";

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
    ...(isEmployer
      ? [
          { href: "/employer/candidates", label: "推荐人才" },
          { href: "/employer/verify", label: "企业验证" }, // #78: from 工作台, not only from 企业主页
          { href: "/employer/team", label: "团队" }, // #87
        ]
      : [
          { href: "/me/saved", label: "收藏和进度" },
          { href: ALERTS_PATH, label: "职位提醒" },
          { href: "/me", label: "浏览与举报" },
        ]),
    // Both identities: on a desktop this sidebar and the account menu are the only ways to it (#76).
    { href: ACCOUNT_DATA_PATH, label: "数据与账号" },
  ];
}

// The current page: brand and semibold with a short 3px line on its left, like the bottom bar (Round 13).
const ACTIVE =
  "relative font-semibold text-brand before:absolute before:top-1/2 before:left-0 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-brand";

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
            className={`pressable-row flex min-h-11 items-center justify-between gap-2 rounded-control px-2.5 text-body ${
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
