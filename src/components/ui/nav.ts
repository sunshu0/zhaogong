// Site navigation by identity (Round 11, C2): the phone's bottom bar, the desktop header and what is highlighted.
// One name per feature everywhere (Round 10 A22 table).
import { POST_JOB_PATH } from "@/components/seeker/identity";
import type { DemoSession } from "@/components/seeker/session";
import type { Messages } from "@/i18n/messages";
import { uiMessages } from "@/i18n/messages/ui";
import type { ExternalSection } from "@/lib/external-jobs/filter";

/** The entries' names (Round 20): the page's language through useMessages(uiMessages).nav, Chinese by default. */
export type NavWords = Messages<typeof uiMessages.zh>["nav"];
const ZH: NavWords = uiMessages.zh.nav;

/** `staff`: an admin's or a moderator's account (ADR 0043), offered only 审核后台 and 我的. */
export type NavRole = "out" | "seeker" | "employer" | "staff";
export type NavKey =
  "jobs" | "internships" | "professional" | "manage" | "post" | "candidates" | "chat" | "workspace" | "mine" | "admin";
/** `preparing`: a job section with no job yet (user feedback 10-30 #4), marked 筹备中 and put last. */
export type NavItem = { key: NavKey; href: string; label: string; preparing?: boolean };

export const ACCOUNT_PATH = "/account";
/** 数据与账号 (#54): export the account's data, delete the account. */
export const ACCOUNT_DATA_PATH = "/account/data";
export const MANAGE_JOBS_PATH = "/employer/jobs";

export const ADMIN_PATH = "/admin";

export function navRole(session: DemoSession | null): NavRole {
  if (!session) return "out";
  if (session.staff) return "staff";
  return session.activeRole === "employer" ? "employer" : "seeker";
}

/**
 * Pages a staff account may stay on (ADR 0043): 审核后台, 我的 (the account, language, signing out), signing in, and
 * the public pages anyone can read. Every other page sends it to 审核后台 (StaffRedirect).
 */
export function staffMayOpen(pathname: string): boolean {
  if (under(pathname, ADMIN_PATH)) return true;
  return [ACCOUNT_PATH, "/login", "/about", "/safety", "/privacy", "/terms"].includes(pathname);
}

/** Where a staff account goes after signing in: `next` if it may stay there (a path, checked with safeNext), else 审核后台. */
export function staffNext(next: string): string {
  const path = next.split(/[?#]/)[0];
  return path !== "/login" && staffMayOpen(path) ? next : ADMIN_PATH;
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
    case "staff":
      return [
        { key: "admin", href: ADMIN_PATH, label: w.admin },
        { key: "mine", href: ACCOUNT_PATH, label: w.mine },
      ];
  }
}

/**
 * Desktop header links (the account menu and 发布招聘 come after them). Signed out there is no 聊天;
 * job seekers get no 发布招聘 (they open an employer identity from the account menu). Visitors and job seekers see
 * the two job sections beside 找工作 (V6, #376); on phones they stay on the job list.
 */
export function headerItems(role: NavRole, w: NavWords = ZH, preparing: readonly ExternalSection[] = []): NavItem[] {
  const items = roleHeaderItems(role, w).map((item) =>
    (item.key === "internships" && preparing.includes("internship")) ||
    (item.key === "professional" && preparing.includes("professional"))
      ? { ...item, preparing: true }
      : item,
  );
  return [...items.filter((item) => !item.preparing), ...items.filter((item) => item.preparing)];
}

function roleHeaderItems(role: NavRole, w: NavWords): NavItem[] {
  switch (role) {
    case "out":
      return [
        { key: "jobs", href: "/jobs", label: w.findJobs },
        { key: "internships", href: "/internships", label: w.internships },
        { key: "professional", href: "/professional", label: w.professional },
      ];
    case "seeker":
      return [
        { key: "jobs", href: "/jobs", label: w.findJobs },
        { key: "internships", href: "/internships", label: w.internships },
        { key: "professional", href: "/professional", label: w.professional },
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
    case "staff":
      return [{ key: "admin", href: ADMIN_PATH, label: w.admin }];
  }
}

/** Whether the header shows the 发布招聘 button: signed out (it leads to employer sign-up) and for employers. */
export function showsPostJob(role: NavRole): boolean {
  return role === "out" || role === "employer";
}

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/**
 * Pages that are part of finding a job besides /jobs (#263): an external job and a business's page opened from a
 * job. The internship and professional sections (#113) have header entries of their own (#376).
 */
const JOB_PAGES = ["/external", "/employers"];

/** Which entry a page belongs to. In the bottom bar, workspace pages count as 我的. */
export function activeNavKey(pathname: string): NavKey | null {
  if (under(pathname, ADMIN_PATH)) return "admin";
  if (under(pathname, "/jobs") || JOB_PAGES.some((base) => under(pathname, base))) return "jobs";
  if (under(pathname, "/internships")) return "internships";
  if (under(pathname, "/professional")) return "professional";
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
      "/profile/resume", // 中英文简历, from 我的主页 (#263)
      "/me",
      "/me/saved",
      "/me/alerts",
      "/employer/verify",
      "/employer/team",
      "/employer/photos", // 门店照片和福利 (ADR 0052)
    ].includes(pathname)
  )
    return "mine";
  return null;
}

/** The bottom bar's highlighted item: workspace pages and 推荐人才 sit under 我的 there, the job sections under 职位. */
export function activeBottomKey(pathname: string): NavKey | null {
  const key = activeNavKey(pathname);
  if (key === "internships" || key === "professional") return "jobs";
  return key === "workspace" || key === "candidates" ? "mine" : key;
}

/**
 * Focused flows hide the bottom bar: they have their own bar at the bottom (posting, editing a job) or are a step
 * on the way somewhere (sign-in). /admin too, except for a staff account, whose home it is (ADR 0043).
 */
export function hidesBottomNav(pathname: string, role?: NavRole): boolean {
  if (under(pathname, ADMIN_PATH)) return role !== "staff";
  if (pathname === "/login" || under(pathname, POST_JOB_PATH)) return true;
  return /^\/employer\/jobs\/[^/]+$/.test(pathname);
}
