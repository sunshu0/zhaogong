"use server";

// 一键申请, the employer's side (#84, PRD R-35): how many applied to each job, the applicant list, and 合适 / 不合适.
// The business is the signed-in account's own (getAccountEmployer); applicants are known by application id only,
// never by email, and an application carries no contact details.
import { getCurrentSession } from "@/lib/auth";
import { getAccountEmployer, getJob } from "@/lib/data";
import type { Employer, Job } from "@/lib/types";
import { candidateFacts } from "@/lib/candidate-matching";
import {
  applicationCounts,
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
} from "@/components/seeker/applications";

export type Applicant = {
  id: string;
  appliedAt: string;
  note: string;
  profile: ApplicationProfile;
  /** The five facts employers check first, from the page the job seeker applied with. */
  facts: { label: string; value: string }[];
  /** True when this visit is the first time the business sees it. */
  isNew: boolean;
  decision: ApplicationDecision | null;
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
 * One of the account's jobs and who applied, oldest first. Opening the list marks every application as seen (the
 * job seeker then sees 「雇主已看过」); `isNew` says which were new on this visit. Null for anyone else's job.
 */
export async function getMyJobApplicants(jobId: string): Promise<{ job: Job; applicants: Applicant[] } | null> {
  const employer = await myBusiness();
  if (!employer || typeof jobId !== "string") return null;
  const job = await getJob(jobId);
  if (!job || job.employerId !== employer.id) return null;
  const rows = await jobApplicationsFor(employer.id, job.id);
  await markApplicationsSeen(employer.id, job.id);
  return {
    job,
    applicants: rows.map((row) => ({
      id: row.id,
      appliedAt: row.appliedAt,
      note: row.note,
      profile: row.profile,
      facts: candidateFacts(applicantCandidate(row.id, row.profile)),
      isNew: !row.seenAt,
      decision: row.decision,
    })),
  };
}

/** Marks one of the business's applicants 合适 or 不合适, or clears it (null). False when it is not theirs. */
export async function decideMyApplicant(applicationId: string, decision: unknown): Promise<boolean> {
  const employer = await myBusiness();
  const parsed = parseDecision(decision);
  if (!employer || typeof applicationId !== "string" || parsed === undefined) return false;
  return decideApplication(employer.id, applicationId, parsed);
}
