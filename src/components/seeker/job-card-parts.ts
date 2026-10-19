// What a job card shows (Round 19, the job list's sample): the title and the pay lead; one light line of points
// (place, work type and hours, shifts, how the employer is reached) without 「地区 / 工时 / 联系」 labels; one
// status, the most important; at most two tags. Pure, for JobCard and its test. Round 20: in the page's language;
// the shifts are the employer's own words, marked Chinese (`zh`) for the English page.
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { seekerJobsMessages } from "@/i18n/messages/seeker-jobs";
import { formatEmploymentTypes } from "@/lib/employment-types";
import type { Employer, Job } from "@/lib/types";
import { formatHours, jobTagKeys, type JobTag } from "@/components/seeker/format";

/** Tags on a card besides its status. */
export const CARD_TAG_LIMIT = 2;

/** One point of the line; `zh`: the employer's own Chinese, not translated. */
export type CardPoint = { text: string; zh?: true };

/** The points line: place, work type and hours, shifts, then how the employer is reached (A25). */
export function cardPoints(job: Job, regionName: string | undefined, lang: Lang = DEFAULT_LANG): CardPoint[] {
  const t = pick(seekerJobsMessages, lang).card;
  const work = [formatEmploymentTypes(job.employmentType, lang), formatHours(job.hoursPerWeek, lang, true)]
    .filter(Boolean)
    .join(" ");
  const shifts = job.shiftsZh?.trim();
  const points: CardPoint[] = [];
  // The card shows whole points on one line and leaves out from the end those that don't fit (#242, 导师 10-19):
  // the area and how to reach the employer (A25) first, so a phone always shows them; then the hours, short; the
  // shifts, in the employer's words, last (the job page has them in full).
  // An area named after two places ("Mt Wellington / Sylvia Park") shows the first: in full it pushed the contact
  // off a 375 px line (gate18). The job page names the area in full.
  const area = regionName?.split(" / ")[0];
  if (area) points.push({ text: area });
  points.push({ text: job.contactPublic ? t.contactPublic : t.contactByChat });
  if (work) points.push({ text: work });
  if (shifts) points.push({ text: shifts, zh: true });
  return points;
}

export type CardStatus = { kind: "urgent" } | { kind: "verified"; verification: Employer["verification"] } | null;

/** The one status a card shows: 急招 first, else a verified employer; nothing for an unverified one. */
export function cardStatus(job: Job, employer: Employer | undefined): CardStatus {
  if (job.urgent) return { kind: "urgent" };
  if (employer && employer.verification !== "unverified")
    return { kind: "verified", verification: employer.verification };
  return null;
}

/** The tags after the status (their keys): perks and visas, at most CARD_TAG_LIMIT. */
export function cardTags(job: Job): JobTag[] {
  return jobTagKeys(job)
    .filter((tag) => tag !== "urgent")
    .slice(0, CARD_TAG_LIMIT);
}
