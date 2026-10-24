import type { EmployerActivity } from "@/lib/employer-activity";
import type { Employer, Job } from "@/lib/types";

/** How much of the description the job list's preview shows; the job page has the rest. */
export const PREVIEW_DESCRIPTION_MAX = 400;

/**
 * A job as the list's preview column gets it (#376), sent to the browser with the list: never the contact details
 * (ADR 0002, they stay on the job page for signed-in job seekers), no English description, the Chinese one cut.
 */
export type PreviewJob = Omit<Job, "contact" | "descriptionEn" | "hiresConfirmed" | "hiresConfirmedAt">;

export type PreviewEmployer = Pick<Employer, "id" | "name" | "verification"> & {
  banned: boolean;
  /** 今天在线, 通常 1 小时内回复 (#381), as on the job's card and page. */
  activity?: EmployerActivity;
};

export function previewJob(job: Job): PreviewJob {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- left out on purpose
  const { contact, descriptionEn, hiresConfirmed, hiresConfirmedAt, ...rest } = job;
  const text = rest.descriptionZh.trim();
  return {
    ...rest,
    descriptionZh:
      text.length > PREVIEW_DESCRIPTION_MAX ? `${text.slice(0, PREVIEW_DESCRIPTION_MAX).trimEnd()}…` : text,
  };
}

export function previewEmployer(employer: Employer, activity?: EmployerActivity): PreviewEmployer {
  return {
    id: employer.id,
    name: employer.name,
    verification: employer.verification,
    banned: Boolean(employer.bannedAt),
    ...(activity && { activity }),
  };
}
