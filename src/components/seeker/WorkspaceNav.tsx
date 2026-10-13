"use client";

import Link from "next/link";
import { useChat } from "@/components/seeker/chat-client";
import { UnreadBadge } from "@/components/seeker/ChatEntry";
import { useNotifications } from "@/components/seeker/hub-client";

type NavItem = { href: string; label: string; short: string };

const WORKSPACE_NAV: NavItem[] = [
  { href: "/workspace", label: "工作台总览", short: "总览" },
  { href: "/messages", label: "聊天", short: "聊天" },
  { href: "/notifications", label: "通知", short: "通知" },
  { href: "/profile", label: "我的主页", short: "主页" },
  { href: "/me", label: "我的记录", short: "记录" },
];
const CANDIDATES_ITEM: NavItem = { href: "/employer/candidates", label: "推荐人才", short: "人才" };
const EMPLOYER_WORDING: Record<string, Pick<NavItem, "label" | "short">> = {
  "/profile": { label: "企业主页", short: "企业" },
  "/me": { label: "招聘记录", short: "招聘" },
};

function workspaceNav(isEmployer: boolean): NavItem[] {
  if (!isEmployer) return WORKSPACE_NAV;
  return WORKSPACE_NAV.flatMap((item) => {
    const employerItem = { ...item, ...EMPLOYER_WORDING[item.href] };
    return item.href === "/messages" ? [employerItem, CANDIDATES_ITEM] : [employerItem];
  });
}

const LAYOUTS = {
  /** Desktop sidebar: full labels, one per line. */
  sidebar: {
    list: "mt-3 space-y-1",
    link: "flex min-h-11 items-center justify-between gap-2 rounded-lg px-2.5 text-sm",
    idle: "hover:bg-background",
    text: "label",
  },
  /** Phone tab strip: short labels in a row. */
  tabs: {
    list: "flex min-w-max gap-1 py-2",
    link: "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm",
    idle: "text-muted",
    text: "short",
  },
} as const;
const ACTIVE = "bg-brand-soft font-medium text-brand";

export function WorkspaceNav({
  pathname,
  isEmployer,
  layout,
}: {
  pathname: string;
  isEmployer: boolean;
  layout: keyof typeof LAYOUTS;
}) {
  const { totalUnread } = useChat();
  const { unread: notificationUnread } = useNotifications();
  const unreadByHref: Record<string, number> = { "/messages": totalUnread, "/notifications": notificationUnread };
  const style = LAYOUTS[layout];
  return (
    <nav aria-label="工作台导航" className={style.list}>
      {workspaceNav(isEmployer).map((item) => {
        const active = pathname === item.href;
        const unread = unreadByHref[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`${style.link} ${active ? ACTIVE : style.idle}`}
          >
            {item[style.text]}
            {unread !== undefined && <UnreadBadge count={unread} />}
          </Link>
        );
      })}
    </nav>
  );
}
