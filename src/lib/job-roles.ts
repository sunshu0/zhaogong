// 岗位类别 (#96, ADR 0013): reading a job's categories from its title. The table is src/config/job-roles.ts.
import { JOB_ROLE_IDS, JOB_ROLES, MAX_JOB_ROLES, type JobRoleId } from "@/config/job-roles";
import type { Industry } from "@/lib/types";

export function isJobRoleId(value: unknown): value is JobRoleId {
  return typeof value === "string" && (JOB_ROLE_IDS as readonly string[]).includes(value);
}

/** Known role ids from untrusted input, without repeats, at most MAX_JOB_ROLES. */
export function parseJobRoles(value: unknown, max = MAX_JOB_ROLES): JobRoleId[] {
  return Array.isArray(value) ? [...new Set(value.filter(isJobRoleId))].slice(0, max) : [];
}

/** Whether a role is found in an industry; 其他 takes any role. */
export function roleFitsIndustry(id: JobRoleId, industry: Industry | undefined): boolean {
  return !industry || industry === "other" || JOB_ROLES[id].industries.includes(industry);
}

/**
 * The categories a job title names, in table order, at most two. Only roles found in the job's industry count, so
 * 前台 is 前厅服务 at a restaurant and 办公文员 at an office, and 店员 at a bubble tea shop is not 理货店员.
 * Empty when the title names none: the job is then 待选 until the employer picks.
 * Migration 0014 filled in the jobs that existed with the same rule, written as SQL.
 */
export function suggestJobRoles(job: { titleZh?: string; titleEn?: string; industry?: Industry }): JobRoleId[] {
  const title = `${job.titleZh ?? ""} ${job.titleEn ?? ""}`.toLowerCase();
  return JOB_ROLE_IDS.filter(
    (id) => roleFitsIndustry(id, job.industry) && JOB_ROLES[id].aliases.some((alias) => title.includes(alias)),
  ).slice(0, MAX_JOB_ROLES);
}

/** The job's categories: the employer's choice, else what its title names (a job from before #96 left 待选). */
export function jobRoles(job: { roles?: JobRoleId[]; titleZh: string; titleEn: string; industry: Industry }) {
  return job.roles?.length ? job.roles : suggestJobRoles(job);
}

export function roleNames(ids: readonly JobRoleId[]): string {
  return ids.map((id) => JOB_ROLES[id].zh).join("、");
}
