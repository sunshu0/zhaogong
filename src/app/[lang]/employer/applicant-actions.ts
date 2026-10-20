"use server";

// A job's candidates, the employer's side (#84, PRD R-35, ADR 0030): how many applied to or chatted about each job,
// the list, and 合适 / 不合适 / 已录用. The business is the signed-in account's own (getAccountEmployer); candidates are
// known by application id only, never by email, and a row carries no contact details.
import { getCurrentSession } from "@/lib/auth";
import { getAccountEmployer, getJob } from "@/lib/data";
import type { Employer, Job } from "@/lib/types";
import { candidateFacts } from "@/lib/candidate-matching";
import { requestLang } from "@/i18n/server";
import {
  applicationCounts,
  chatCandidate,
  decideApplication,
  jobApplicationsFor,
  markApplicationsSeen,
  type ApplicationCount,
} from "@/db/job-applications";
import {
  applicantCandidate,
  parseDecision,
  type ApplicationDecision,
  type ApplicationProfile,
  type ApplicationSource,
} from "@/components/seeker/applications";
import { interviewsFor, interviewView } from "@/db/interviews";
import { findSharedConversation, seekerJobKey, seekerNamesOfBusiness } from "@/db/conversations";
import type { InterviewView } from "@/components/seeker/interviews";
import { parseSharedId } from "@/lib/chat-server/shared-view";

export type Applicant = {
  id: string;
  /** Applied (with a note and their page), or came from a chat (neither, ADR 0030). */
  source: ApplicationSource;
  /** The name on the page they applied with, or the one the business sees in the chat; empty when unknown. */
  name: string;
  appliedAt: string;
  note: string | null;
  profile: ApplicationProfile | null;
  /** The five facts employers check first, from the page the job seeker applied with; none for a chat. */
  facts: { label: string; value: string }[];
  /** True when this visit is the first time the business sees it. */
  isNew: boolean;
  decision: ApplicationDecision | null;
  /** The interview invitation, if the business sent one (#103). */
  interview: InterviewView | null;
};

async function myBusiness(): Promise<Employer | null> {
  const session = await getCurrentSession();
  return session ? ((await getAccountEmployer(session.email)) ?? null) : null;
}

/** Applications to each of the account's jobs: how many, and how many not looked at yet. */
export async function getMyApplicationCounts(): Promise<Record<string, ApplicationCount>> {
  const employer = await myBusiness();
  return employer ? applicationCounts(employer.id) : {};
}

/**
 * One of the account's jobs and who applied, oldest first; `isNew` for those the business has not looked at yet.
 * Reading changes nothing: the page then calls markMyApplicantsSeen. Null for anyone else's job.
 */
export async function getMyJobApplicants(jobId: string): Promise<{ job: Job; applicants: Applicant[] } | null> {
  const employer = await myBusiness();
  if (!employer || typeof jobId !== "string") return null;
  const job = await getJob(jobId);
  if (!job || job.employerId !== employer.id) return null;
  const rows = await jobApplicationsFor(employer.id, job.id);
  const interviews = await interviewsFor(rows.map((row) => row.id));
  const names = rows.some((row) => !row.profile) ? await seekerNamesOfBusiness(employer.id) : new Map<string, string>();
  const lang = await requestLang();
  return {
    job,
    applicants: rows.map((row) => ({
      id: row.id,
      source: row.source,
      name: row.profile?.name ?? names.get(seekerJobKey(row.seekerEmail, row.jobId)) ?? "",
      appliedAt: row.appliedAt,
      note: row.note,
      profile: row.profile,
      facts: row.profile ? candidateFacts(applicantCandidate(row.id, row.profile), lang) : [],
      isNew: !row.seenAt,
      decision: row.decision,
      interview: interviews.has(row.id) ? interviewView(interviews.get(row.id)!) : null,
    })),
  };
}

/** The business has looked at the job's applicants: the job seekers then see 「雇主已看过」. */
export async function markMyApplicantsSeen(jobId: string): Promise<void> {
  const employer = await myBusiness();
  if (!employer || typeof jobId !== "string") return;
  await markApplicationsSeen(employer.id, jobId);
}

/** Marks one of the business's candidates 合适, 不合适 or 已录用, or clears it (null). False when it is not theirs. */
export async function decideMyApplicant(applicationId: string, decision: unknown): Promise<boolean> {
  const employer = await myBusiness();
  const parsed = parseDecision(decision);
  if (!employer || typeof applicationId !== "string" || parsed === undefined) return false;
  return decideApplication(employer.id, applicationId, parsed);
}

/**
 * The mark on the job seeker of one of the business's shared conversations (`chat:<id>`), for the chat's job bar
 * (ADR 0030): null while unmarked or nothing has been said; undefined for anyone else's or a conversation that is not
 * shared, where the bar shows no marks.
 */
export async function getMyChatCandidate(
  conversationId: string,
): Promise<{ decision: ApplicationDecision | null } | undefined> {
  const employer = await myBusiness();
  const key = parseSharedId(conversationId, "employer");
  if (!employer || !key || !("rowId" in key)) return undefined;
  if (!(await findSharedConversation({ side: "employer", employerId: employer.id }, key))) return undefined;
  const row = await chatCandidate(employer.id, key.rowId);
  return { decision: row?.decision ?? null };
}

/** Marks the job seeker of one of the business's shared conversations, as decideMyApplicant does. */
export async function decideMyChatCandidate(conversationId: string, decision: unknown): Promise<boolean> {
  const employer = await myBusiness();
  const key = parseSharedId(conversationId, "employer");
  const parsed = parseDecision(decision);
  if (!employer || !key || !("rowId" in key) || parsed === undefined) return false;
  const row = await chatCandidate(employer.id, key.rowId, true);
  return row ? decideApplication(employer.id, row.id, parsed) : false;
}
