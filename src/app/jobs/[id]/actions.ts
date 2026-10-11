"use server";

import { getJob } from "@/lib/data";
import type { Job } from "@/lib/types";
import { isPublic } from "@/components/seeker/job-facts";
import { isValidEmail, normalizeEmail } from "@/components/seeker/session";

/**
 * A job's contact details, fetched after sign-in so they are not in the page HTML for everyone.
 * Demo only: the session lives in the browser, so the server trusts the email it is given.
 * When real authentication arrives, check the session here instead.
 */
export async function revealContact(jobId: string, email: string): Promise<Job["contact"] | null> {
  if (typeof jobId !== "string" || typeof email !== "string" || !isValidEmail(normalizeEmail(email))) return null;
  const job = await getJob(jobId);
  if (!job || !isPublic(job)) return null;
  const { phone, wechat, email: contactEmail } = job.contact;
  return { phone, wechat, email: contactEmail };
}
