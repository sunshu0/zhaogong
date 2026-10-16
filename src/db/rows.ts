// Between database rows and the shapes in src/lib/types.ts. Pay is stored in cents (24.5 → 2450) and read
// back in dollars; NULL columns come back as missing keys, as in the demo objects.
import type { Account, ContactView, Employer, Job, ModerationLogEntry, Report } from "@/lib/types";
import type * as schema from "@/db/schema";

export type JobRow = typeof schema.jobs.$inferSelect;
export type EmployerRow = typeof schema.employers.$inferSelect;
export type ReportRow = typeof schema.reports.$inferSelect;
export type ContactViewRow = typeof schema.contactViews.$inferSelect;
export type LogRow = typeof schema.moderationLog.$inferSelect;
export type AccountRow = typeof schema.accounts.$inferSelect;

export const toCents = (dollars: number) => Math.round(dollars * 100);
export const toDollars = (cents: number) => cents / 100;

/** The object without the keys whose value is null (NULL columns) or undefined. */
function present<T extends object>(o: T): { [K in keyof T]: Exclude<T[K], null> } {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v != null)) as { [K in keyof T]: Exclude<T[K], null> };
}

export function toJob(r: JobRow): Job {
  const { payMin, payMax, hoursMin, hoursMax, ...rest } = r;
  return {
    ...(present(rest) as Omit<Job, "pay" | "hoursPerWeek">),
    pay: payMax != null ? { min: toDollars(payMin), max: toDollars(payMax) } : { min: toDollars(payMin) },
    ...(hoursMin != null && { hoursPerWeek: hoursMax != null ? { min: hoursMin, max: hoursMax } : { min: hoursMin } }),
  };
}

export function fromJob(job: Job): JobRow {
  const { pay, hoursPerWeek, ...rest } = job;
  return {
    ...rest,
    address: job.address ?? null,
    shiftsZh: job.shiftsZh ?? null,
    hiresConfirmed: job.hiresConfirmed ?? null,
    hiresConfirmedAt: job.hiresConfirmedAt ?? null,
    payMin: toCents(pay.min),
    payMax: pay.max != null ? toCents(pay.max) : null,
    hoursMin: hoursPerWeek?.min ?? null,
    hoursMax: hoursPerWeek?.max ?? null,
  };
}

/** Optional job fields: a patch that has the key with no value clears the column (an edit emptied it). */
const CLEARABLE = ["address", "shiftsZh", "hiresConfirmed", "hiresConfirmedAt"] as const;

/** The columns an updateJob patch changes. */
export function jobPatch(patch: Partial<Omit<Job, "id" | "country">>): Partial<JobRow> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (key === "pay") {
      if (value) {
        const pay = value as Job["pay"];
        out.payMin = toCents(pay.min);
        out.payMax = pay.max != null ? toCents(pay.max) : null;
      }
    } else if (key === "hoursPerWeek") {
      const hours = value as Job["hoursPerWeek"];
      out.hoursMin = hours?.min ?? null;
      out.hoursMax = hours?.max ?? null;
    } else if ((CLEARABLE as readonly string[]).includes(key)) {
      out[key] = value ?? null;
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as Partial<JobRow>;
}

export const toEmployer = (r: EmployerRow): Employer => present(r) as Employer;

export function fromEmployer(e: Employer): EmployerRow {
  return {
    ...e,
    legalName: e.legalName ?? null,
    businessNumber: e.businessNumber ?? null,
    bannedAt: e.bannedAt ?? null,
  };
}

export const toReport = (r: ReportRow): Report => present(r) as Report;

export const toContactView = ({ jobId, viewerEmail, viewedAt }: ContactViewRow): ContactView => ({
  jobId,
  viewerEmail,
  viewedAt,
});

export const toLogEntry = (r: LogRow): ModerationLogEntry => present(r) as ModerationLogEntry;

export const toAccount = ({ email, createdAt, employerId, teamRole, teamName }: AccountRow): Account => ({
  email,
  createdAt,
  ...(employerId != null && { employerId, teamRole: teamRole ?? "admin" }),
  ...(employerId != null && teamName != null && { teamName }),
});
