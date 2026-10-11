"use server";
// Server Functions for the employer pages, so reads and writes hit the same in-memory data the
// job seekers' pages read. Demo only: there is no real session, so the caller says who it is.
// The backend must check the signed-in employer here before trusting employerId.
import { listJobsByEmployer } from "@/lib/data";
import type { Job } from "@/lib/types";

/** Every job of one employer, newest first, whatever its status. */
export async function getMyJobs(employerId: string): Promise<Job[]> {
  const jobs = await listJobsByEmployer(employerId);
  return [...jobs].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}
