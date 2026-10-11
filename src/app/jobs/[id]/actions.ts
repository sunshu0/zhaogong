"use server";

import { getJob, listContactViews, recordContactView, submitReport } from "@/lib/data";
import type { Job } from "@/lib/types";
import { isPublic } from "@/components/seeker/job-facts";
import { parseReport } from "@/components/seeker/report";
import { isValidEmail, normalizeEmail } from "@/components/seeker/session";

/** The job page fetches contact details on every visit, so one person counts once per job in this window. */
const RECORD_AGAIN_AFTER_MS = 30 * 60 * 1000;

/**
 * A job's contact details, fetched after sign-in so they are not in the page HTML for everyone, and
 * recorded with recordContactView so the employer side can see who looked.
 * Demo only: the session lives in the browser, so the server trusts the email it is given.
 * When real authentication arrives, check the session here instead.
 */
export async function revealContact(jobId: string, email: string): Promise<Job["contact"] | null> {
  if (typeof jobId !== "string" || typeof email !== "string") return null;
  const viewer = normalizeEmail(email);
  if (!isValidEmail(viewer)) return null;
  const job = await getJob(jobId);
  if (!job || !isPublic(job)) return null;

  const last = (await listContactViews(job.id)).find((v) => v.viewerEmail === viewer);
  if (!last || Date.now() - Date.parse(last.viewedAt) >= RECORD_AGAIN_AFTER_MS) await recordContactView(job.id, viewer);

  const { phone, wechat, email: contactEmail } = job.contact;
  return { phone, wechat, email: contactEmail };
}

export type ReportResult = { ok: true; reportId: string } | { ok: false; error: string };

/** Sends a report on a job seekers can see. Anyone can report; signing in is not needed. */
export async function reportJob(jobId: string, reason: string, note?: string): Promise<ReportResult> {
  const parsed = parseReport({ reason, note });
  if (!parsed.ok) return parsed;
  const job = typeof jobId === "string" ? await getJob(jobId) : undefined;
  if (!job || !isPublic(job)) return { ok: false, error: "找不到这个职位，可能已经下架" };
  const report = await submitReport(job.id, parsed.reason, parsed.note);
  return { ok: true, reportId: report.id };
}
