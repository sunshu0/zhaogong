import { getEmployer } from "@/lib/data";
import type { Employer, Job } from "@/lib/types";

/** The employers of a list of jobs, by id, each looked up once. */
export async function employersOf(jobs: Job[]): Promise<Map<string, Employer>> {
  const ids = [...new Set(jobs.map((j) => j.employerId))];
  const found = await Promise.all(ids.map((id) => getEmployer(id)));
  return new Map(found.filter((e): e is Employer => e != null).map((e) => [e.id, e]));
}
