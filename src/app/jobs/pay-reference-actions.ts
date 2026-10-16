"use server";

// 时薪参考 (#85, PRD R-36) for the employer's post form: worked out on the server from the platform's open jobs
// (listJobs), the same as on job pages. Public numbers only: counts and rates, no job or business.
import { DEFAULT_COUNTRY, regionById } from "@/config/countries";
import { listJobs } from "@/lib/data";
import { INDUSTRY_LABELS } from "@/i18n/labels";
import { payReference, type PayReference } from "@/lib/pay-reference";
import type { Industry } from "@/lib/types";

export type PayReferenceAnswer = { reference: PayReference; at: string };

/** The pay of open jobs in the industry, in the region or across its area; `exclude` leaves out a job being edited. */
export async function payReferenceFor(
  industry: unknown,
  regionId: unknown,
  exclude?: unknown,
): Promise<PayReferenceAnswer | null> {
  if (typeof industry !== "string" || !(industry in INDUSTRY_LABELS)) return null;
  const country = DEFAULT_COUNTRY;
  const region = typeof regionId === "string" && regionById(country, regionId) ? regionId : undefined;
  const now = new Date();
  const jobs = await listJobs({ country }, now.getTime());
  return {
    reference: payReference(jobs, {
      country,
      industry: industry as Industry,
      regionId: region,
      exclude: typeof exclude === "string" ? exclude : undefined,
    }),
    at: now.toISOString(),
  };
}
