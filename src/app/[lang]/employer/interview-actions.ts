"use server";

// 约面试, the employer's side (#103): invite an applicant, change the times, or cancel. The business is the
// signed-in account's own; the applicant is known by application id only. Any times, any number, or none
// (电话联系后再定): parseInvite only refuses what is not a time or is already past.
import { getCurrentSession } from "@/lib/auth";
import { getAccountEmployer } from "@/lib/data";
import { cancelInterview, interviewView, inviteToInterview } from "@/db/interviews";
import { parseInvite, type InterviewView } from "@/components/seeker/interviews";
import { pick } from "@/i18n/messages";
import { employerApplicantsMessages } from "@/i18n/messages/employer-applicants";
import { requestLang } from "@/i18n/server";

export type InviteResult = { ok: true; interview: InterviewView } | { ok: false; error: string };

async function myBusinessId(): Promise<string | null> {
  const session = await getCurrentSession();
  if (!session || session.activeRole !== "employer") return null;
  return (await getAccountEmployer(session.email))?.id ?? null;
}

/** Invites the applicant, or replaces the invitation: it is open again and the earlier answer is cleared. */
export async function inviteMyApplicant(applicationId: string, invite: unknown): Promise<InviteResult> {
  const lang = await requestLang();
  const t = pick(employerApplicantsMessages, lang).interviewActions;
  const employerId = await myBusinessId();
  if (!employerId || typeof applicationId !== "string") return { ok: false, error: t.signInAsEmployer };
  const now = new Date();
  const parsed = parseInvite(invite, now.getTime(), lang);
  if (!parsed.ok) return parsed;
  const row = await inviteToInterview(employerId, applicationId, parsed.invite, now);
  return row ? { ok: true, interview: interviewView(row) } : { ok: false, error: t.applicationGone };
}

/** Calls the interview off; the job seeker is told. Null when it is not the business's. */
export async function cancelMyApplicantInterview(applicationId: string): Promise<InterviewView | null> {
  const employerId = await myBusinessId();
  if (!employerId || typeof applicationId !== "string") return null;
  const row = await cancelInterview(employerId, applicationId);
  return row ? interviewView(row) : null;
}
