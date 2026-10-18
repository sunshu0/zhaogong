"use server";

// 企业主页 on the server (ADR 0022): the business's page is the team's, so every member and every visitor sees the
// same one, and only an admin changes it. Who acts comes from this browser's session cookie, the business from that
// account; the server keeps only what parseEmployerPage lets through.
import { getCurrentSession } from "@/lib/auth";
import { getAccountEmployer } from "@/lib/data";
import { getTeam } from "@/db/team";
import { getEmployerPage, listPublicEmployerPages, saveEmployerPage } from "@/db/employer-profiles";
import { canEditPage, parseEmployerPage, publicPage, type EmployerPage } from "@/components/employer/employer-page";
import { checkEmployerPage, type PageFinding } from "@/components/employer/employer-page-check";
import type { EmployerPublicProfile } from "@/lib/employer-public-profile";
import { scopeOf } from "@/lib/chat-server/identity";
import { requestLang } from "@/i18n/server";

/**
 * The business's page as the server has it, for someone in its team: `page` is null while nobody saved one.
 * `scope` names the identity the answer is for (a browser that switched meanwhile does not take it for another),
 * `canEdit` whether this person may change it, `admins` who can (their team names, or emails).
 */
export type EmployerPageSnapshot = {
  scope: string;
  page: EmployerPage | null;
  updatedAt: string | null;
  canEdit: boolean;
  admins: string[];
  /** Set when a save was refused because something cannot be public (#195): nothing was saved. */
  refused?: PageFinding[];
};

async function myBusiness() {
  const session = await getCurrentSession();
  if (!session || session.activeRole !== "employer") return null;
  const employer = await getAccountEmployer(session.email);
  return employer ? { session, employer } : null;
}

async function snapshot(mine: NonNullable<Awaited<ReturnType<typeof myBusiness>>>): Promise<EmployerPageSnapshot> {
  const [row, members] = await Promise.all([getEmployerPage(mine.employer.id), getTeam(mine.employer.id)]);
  const me = members.find((m) => m.email === mine.session.email);
  return {
    scope: scopeOf(mine.session),
    page: row?.page ?? null,
    updatedAt: row?.updatedAt ?? null,
    canEdit: canEditPage(me?.role),
    admins: members.filter((m) => m.role === "admin").map((m) => m.name ?? m.email),
  };
}

/** Null when signed out, signed in as a job seeker, or without a business. */
export async function myEmployerPage(): Promise<EmployerPageSnapshot | null> {
  const mine = await myBusiness();
  return mine ? snapshot(mine) : null;
}

/**
 * Saves the whole page the browser has. A member gets the page as it is, with `canEdit` false, and nothing changes;
 * so does a page with something that cannot be public, with `refused` saying what (#195). Null when there is no
 * business signed in or what came is not a page.
 */
export async function saveMyEmployerPage(page: unknown): Promise<EmployerPageSnapshot | null> {
  const mine = await myBusiness();
  if (!mine) return null;
  const parsed = parseEmployerPage(page);
  if (!parsed) return null;
  const findings = checkEmployerPage(parsed, "NZ", await requestLang());
  if (findings.length) return { ...(await snapshot(mine)), refused: findings };
  const saved = await saveEmployerPage(mine.session.email, parsed);
  if (saved === "no_business") return null;
  return snapshot(mine);
}

/** At most this many businesses in one ask (a page shows a handful: its own, or the chats' counterparts). */
const MAX_PAGES_PER_ASK = 50;

/**
 * The public pages of these businesses, for anyone (the public employer page, avatars in job cards and chats). A
 * business that has no page yet, or is banned, is not in the answer.
 */
export async function employerPublicPages(employerIds: unknown): Promise<Record<string, EmployerPublicProfile>> {
  if (!Array.isArray(employerIds)) return {};
  const ids = [...new Set(employerIds.filter((id): id is string => typeof id === "string" && id.length <= 100))];
  const rows = await listPublicEmployerPages(ids.slice(0, MAX_PAGES_PER_ASK));
  return Object.fromEntries(rows.map((row) => [row.employerId, publicPage(row.businessName, row.page)]));
}
