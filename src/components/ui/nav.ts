// Site navigation by identity (Round 11, C2): the phone's bottom bar, the desktop header and what is highlighted.
// One name per feature everywhere (Round 10 A22 table).
import { POST_JOB_PATH } from "@/components/seeker/identity";
import type { DemoSession } from "@/components/seeker/session";

export type NavRole = "out" | "seeker" | "employer";
export type NavKey = "jobs" | "manage" | "post" | "candidates" | "chat" | "workspace" | "mine";
export type NavItem = { key: NavKey; href: string; label: string };

export const ACCOUNT_PATH = "/account";
export const MANAGE_JOBS_PATH = "/employer/jobs";

export function navRole(session: DemoSession | null): NavRole {
  if (!session) return "out";
  return session.activeRole === "employer" ? "employer" : "seeker";
}

const signInFirst = (next: string) => `/login?next=${encodeURIComponent(next)}`;

/** Phone bottom bar. Signed out, 聊天 and 我的 go through sign-in. 发布 is drawn as the raised middle button. */
export function bottomNavItems(role: NavRole): NavItem[] {
  switch (role) {
    case "out":
      return [
        { key: "jobs", href: "/jobs", label: "职位" },
        { key: "chat", href: signInFirst("/messages"), label: "聊天" },
        { key: "mine", href: signInFirst(ACCOUNT_PATH), label: "我的" },
      ];
    case "seeker":
      return [
        { key: "jobs", href: "/jobs", label: "职位" },
        { key: "chat", href: "/messages", label: "聊天" },
        { key: "mine", href: ACCOUNT_PATH, label: "我的" },
      ];
    case "employer":
      return [
        { key: "manage", href: MANAGE_JOBS_PATH, label: "职位管理" },
        { key: "post", href: POST_JOB_PATH, label: "发布" },
        { key: "chat", href: "/messages", label: "聊天" },
        { key: "mine", href: ACCOUNT_PATH, label: "我的" },
      ];
  }
}

/**
 * Desktop header links (the account menu and 发布招聘 come after them). Signed out there is no 聊天;
 * job seekers get no 发布招聘 (they open an employer identity from the account menu).
 */
export function headerItems(role: NavRole): NavItem[] {
  switch (role) {
    case "out":
      return [{ key: "jobs", href: "/jobs", label: "找工作" }];
    case "seeker":
      return [
        { key: "jobs", href: "/jobs", label: "找工作" },
        { key: "chat", href: "/messages", label: "聊天" },
        { key: "workspace", href: "/workspace", label: "工作台" },
      ];
    case "employer":
      return [
        { key: "manage", href: MANAGE_JOBS_PATH, label: "职位管理" },
        { key: "candidates", href: "/employer/candidates", label: "推荐人才" },
        { key: "chat", href: "/messages", label: "聊天" },
        { key: "workspace", href: "/workspace", label: "工作台" },
      ];
  }
}

/** Whether the header shows the 发布招聘 button: signed out (it leads to employer sign-up) and for employers. */
export function showsPostJob(role: NavRole): boolean {
  return role !== "seeker";
}

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** Which entry a page belongs to. In the bottom bar, workspace pages count as 我的. */
export function activeNavKey(pathname: string): NavKey | null {
  if (under(pathname, "/jobs")) return "jobs";
  if (under(pathname, POST_JOB_PATH)) return "post";
  if (under(pathname, MANAGE_JOBS_PATH) || pathname === "/employer") return "manage";
  if (under(pathname, "/employer/candidates")) return "candidates";
  if (under(pathname, "/messages")) return "chat";
  if (pathname === "/workspace") return "workspace";
  if (
    [ACCOUNT_PATH, "/notifications", "/profile", "/me", "/me/saved", "/me/alerts", "/employer/verify"].includes(
      pathname,
    )
  )
    return "mine";
  return null;
}

/** The bottom bar's highlighted item: workspace pages and 推荐人才 sit under 我的 there. */
export function activeBottomKey(pathname: string): NavKey | null {
  const key = activeNavKey(pathname);
  return key === "workspace" || key === "candidates" ? "mine" : key;
}

/**
 * Focused flows hide the bottom bar: they have their own bar at the bottom (posting, editing a job) or are a step
 * on the way somewhere (sign-in).
 */
export function hidesBottomNav(pathname: string): boolean {
  if (pathname === "/login" || under(pathname, "/admin") || under(pathname, POST_JOB_PATH)) return true;
  return /^\/employer\/jobs\/[^/]+$/.test(pathname);
}
