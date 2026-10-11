"use server";
// Server Functions for the employer pages, so reads and writes hit the same in-memory data the
// job seekers' pages read. Demo only: there is no real session, so the caller says who it is.
// The backend must check the signed-in employer here before trusting employerId.
import { DEFAULT_COUNTRY } from "@/config/countries";
import { parsePost, missingFields, type ParsedPost, type RequiredField } from "@/lib/ai-post";
import { checkJob, publishDecision, type Finding } from "@/lib/compliance";
import { createJob, getEmployer, listJobsByEmployer } from "@/lib/data";
import type { Job } from "@/lib/types";
import { completeJob, sanitizeDraft } from "@/components/employer/post-form";

/** Every job of one employer, newest first, whatever its status. */
export async function getMyJobs(employerId: string): Promise<Job[]> {
  const jobs = await listJobsByEmployer(employerId);
  return [...jobs].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}

/** Runs on the server so a real model call can replace the stub without exposing a key. */
export async function parseDraft(text: string): Promise<ParsedPost> {
  return parsePost(String(text).slice(0, 5000), DEFAULT_COUNTRY);
}

export type PublishResult =
  | { ok: true; job: Job }
  | { ok: false; reason: "unknown_employer" | "not_ready"; findings: Finding[]; missing: RequiredField[] };

/** Checks the draft again on the server, then publishes it as active or pending review. */
export async function publishJob(input: unknown, employerId: string): Promise<PublishResult> {
  const draft = sanitizeDraft(input, DEFAULT_COUNTRY);
  const findings = checkJob(draft, DEFAULT_COUNTRY);
  const missing = missingFields(draft);
  if (!(await getEmployer(String(employerId)))) return { ok: false, reason: "unknown_employer", findings, missing };

  const decision = publishDecision(findings);
  const job = decision.canPublish ? completeJob(draft, employerId, Date.now(), decision.status) : undefined;
  if (!job) return { ok: false, reason: "not_ready", findings, missing };
  return { ok: true, job: await createJob(job) };
}
