"use server";

// 中英文简历的分享链接 (#86, PRD R-37). The account is the one in this browser's session cookie; the page sends
// only its resume (the profile lives in the browser), and the server keeps what it parses, never the email.
import { getCurrentSession } from "@/lib/auth";
import { closeResumeShare, myResumeShare, saveResumeShare } from "@/db/resume-shares";
import { parseResumeDoc, shareCopy, type ResumeDoc } from "@/components/seeker/resume-doc";

/** An open link: its path, and the page it shows (for its owner, to tell whether the page changed since). */
export type ResumeShareView = { path: string; updatedAt: string; resume: ResumeDoc };

export type ShareResult = { ok: true; share: ResumeShareView } | { ok: false; error: string };

const view = (row: { id: string; updatedAt: string; resume: ResumeDoc }): ResumeShareView => ({
  path: `/resume/${row.id}`,
  updatedAt: row.updatedAt,
  resume: row.resume,
});

/** The account's open link, or null (none, signed out, or signed in as an employer). */
export async function myResumeShareLink(): Promise<ResumeShareView | null> {
  const session = await getCurrentSession();
  if (!session || session.activeRole !== "seeker") return null;
  const row = await myResumeShare(session.email);
  return row ? view(row) : null;
}

/** Opens the link, or updates what it shows. */
export async function shareMyResume(resume: unknown): Promise<ShareResult> {
  const session = await getCurrentSession();
  if (!session) return { ok: false, error: "请先登录" };
  if (session.activeRole !== "seeker") return { ok: false, error: "请切换为求职者身份后再分享简历" };
  const doc = parseResumeDoc(resume);
  if (!doc) return { ok: false, error: "先在主页填写称呼，再分享简历" };
  const row = await saveResumeShare(session.email, shareCopy(doc));
  if (row === "no_account") return { ok: false, error: "请先登录" };
  return { ok: true, share: view(row) };
}

/** Closes the link; anyone opening it from now on sees that it is closed. */
export async function closeMyResumeShare(): Promise<boolean> {
  const session = await getCurrentSession();
  if (!session) return false;
  return closeResumeShare(session.email);
}
