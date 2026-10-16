// What a job card shows (Round 19, the job list's sample): the title and the pay lead; one light line of points
// (place, work type and hours, shifts, how the employer is reached) without 「地区 / 工时 / 联系」 labels; one
// status, the most important; at most two tags. Pure, for JobCard and its test.
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { Employer, Job } from "@/lib/types";
import { formatHours, jobTags } from "@/components/seeker/format";

/** Tags on a card besides its status. */
export const CARD_TAG_LIMIT = 2;

/** The points line: place, work type and hours, shifts, then how the employer is reached (A25). */
export function cardPoints(job: Job, regionName: string | undefined): string[] {
  const work = [formatEmploymentTypes(job.employmentType), formatHours(job.hoursPerWeek)].filter(Boolean).join(" ");
  return [regionName, work, job.shiftsZh?.trim(), job.contactPublic ? "联系方式公开" : "聊天交换联系方式"].filter(
    (point): point is string => Boolean(point),
  );
}

export type CardStatus = { kind: "urgent" } | { kind: "verified"; verification: Employer["verification"] } | null;

/** The one status a card shows: 急招 first, else a verified employer; nothing for an unverified one. */
export function cardStatus(job: Job, employer: Employer | undefined): CardStatus {
  if (job.urgent) return { kind: "urgent" };
  if (employer && employer.verification !== "unverified")
    return { kind: "verified", verification: employer.verification };
  return null;
}

/** The tags after the status: perks and visas, at most CARD_TAG_LIMIT. */
export function cardTags(job: Job): string[] {
  return jobTags(job)
    .filter((tag) => tag !== "急招")
    .slice(0, CARD_TAG_LIMIT);
}
