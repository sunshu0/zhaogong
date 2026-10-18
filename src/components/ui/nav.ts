// Site navigation by identity (Round 11, C2): the phone's bottom bar, the desktop header and what is highlighted.
// One name per feature everywhere (Round 10 A22 table).
import { POST_JOB_PATH } from "@/components/seeker/identity";
import type { DemoSession } from "@/components/seeker/session";
import type { Messages } from "@/i18n/messages";
import { uiMessages } from "@/i18n/messages/ui";

/** The entries' names (Round 20): the page's language through useMessages(uiMessages).nav, Chinese by default. */
export type NavWords = Messages<typeof uiMessages.zh>["nav"];
const ZH: NavWords = uiMessages.zh.nav;

export type NavRole = "out" | "seeker" | "employer";
export type NavKey = "jobs" | "manage" | "post" | "candidates" | "chat" | "workspace" | "mine";
export type NavItem = { key: NavKey; href: string; label: string };

export const ACCOUNT_PATH = "/account";
/** 数据与账号 (#54): export the account's data, delete the account. */
export const ACCOUNT_DATA_PATH = "/account/data";
export const MANAGE_JOBS_PATH = "/employer/jobs";

export function navRole(session: DemoSession | null): NavRole {
  if (!session) return "out";
  return session.activeRole === "employer" ? "employer" : "seeker";
}

const signInFirst = (next: string) => `/login?next=${encodeURIComponent(next)}`;

/** Phone bottom bar. Signed out, 聊天 and 我的 go through sign-in. 发布 is drawn as the raised middle button. */
export function bottomNavItems(role: NavRole, w: NavWords = ZH): NavItem[] {
  switch (role) {
    case "out":
      return [
        { key: "jobs", href: "/jobs", label: w.jobs },
        { key: "chat", href: signInFirst("/messages"), label: w.chat },
        { key: "mine", href: signInFirst(ACCOUNT_PATH), label: w.mine },
      ];
    case "seeker":
      return [
        { key: "jobs", href: "/jobs", label: w.jobs },
        { key: "chat", href: "/messages", label: w.chat },
        { key: "mine", href: ACCOUNT_PATH, label: w.mine },
      ];
    case "employer":
      return [
        { key: "manage", href: MANAGE_JOBS_PATH, label: w.manage },
        { key: "post", href: POST_JOB_PATH, label: w.post },
        { key: "chat", href: "/messages", label: w.chat },
        { key: "mine", href: ACCOUNT_PATH, label: w.mine },
      ];
  }
}

/**
 * Desktop header links (the account menu and 发布招聘 come after them). Signed out there is no 聊天;
 * job seekers get no 发布招聘 (they open an employer identity from the account menu).
 */
export function headerItems(role: NavRole, w: NavWords = ZH): NavItem[] {
  switch (role) {
    case "out":
      return [{ key: "jobs", href: "/jobs", label: w.findJobs }];
    case "seeker":
      return [
        { key: "jobs", href: "/jobs", label: w.findJobs },
        { key: "chat", href: "/messages", label: w.chat },
        { key: "workspace", href: "/workspace", label: w.workspace },
      ];
    case "employer":
      return [
        { key: "manage", href: MANAGE_JOBS_PATH, label: w.manage },
        { key: "candidates", href: "/employer/candidates", label: w.candidates },
        { key: "chat", href: "/messages", label: w.chat },
        { key: "workspace", href: "/workspace", label: w.workspace },
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
    [
      ACCOUNT_PATH,
      ACCOUNT_DATA_PATH,
      "/notifications",
      "/profile",
      "/me",
      "/me/saved",
      "/me/alerts",
      "/employer/verify",
      "/employer/team",
    ].includes(pathname)
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
