// 时薪参考 (#85, PRD R-36): what jobs of the same industry pay, from the platform's own open jobs only. No outside
// data, and nothing about visa or immigration pay thresholds.
import { COUNTRIES, regionById } from "@/config/countries";
import type { CountryCode, Industry, Job } from "@/lib/types";

/** Fewer jobs than this in the region: widen to the whole area (Auckland); fewer there too: no reference. */
export const MIN_SAMPLE = 5;

export type PayReference =
  | {
      /** `region`: the same region; `area`: the region was too small, so the whole area (全奥克兰). */
      scope: "region" | "area";
      /** The region or area's name, as the page says it. */
      place: string;
      min: number;
      median: number;
      max: number;
      count: number;
    }
  | { scope: "none"; count: number };

/** One job's rate for the reference: the middle of its range (a fixed rate is its own middle). */
export function jobRate(pay: Job["pay"]): number {
  return pay.max != null && pay.max > pay.min ? (pay.min + pay.max) / 2 : pay.min;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The pay of open jobs in the same industry: in the same region, or across its area when the region has fewer than
 * MIN_SAMPLE. `jobs` should be the open jobs (listJobs); `exclude` leaves out the job being looked at or edited.
 * Lowest and highest are the ends of the jobs' ranges; the median is of each job's middle rate (jobRate).
 */
export function payReference(
  jobs: Pick<Job, "id" | "country" | "industry" | "regionId" | "pay">[],
  target: { country: CountryCode; industry: Industry; regionId?: string; exclude?: string },
): PayReference {
  const same = jobs.filter(
    (j) => j.country === target.country && j.industry === target.industry && j.id !== target.exclude,
  );
  const region = target.regionId ? regionById(target.country, target.regionId) : undefined;
  const area = region?.area;
  const inArea = same.filter((j) => !area || regionById(j.country, j.regionId)?.area === area);
  const inRegion = region ? same.filter((j) => j.regionId === region.id) : [];

  const [scope, sample, place] =
    inRegion.length >= MIN_SAMPLE
      ? (["region", inRegion, region!.nameZh] as const)
      : inArea.length >= MIN_SAMPLE
        ? (["area", inArea, areaName(target.country, area)] as const)
        : (["none", inArea, ""] as const);
  if (scope === "none") return { scope, count: sample.length };

  const rates = sample.map((j) => jobRate(j.pay)).sort((a, b) => a - b);
  return {
    scope,
    place,
    min: Math.min(...sample.map((j) => j.pay.min)),
    median: Math.round(median(rates) * 100) / 100,
    max: Math.max(...sample.map((j) => j.pay.max ?? j.pay.min)),
    count: sample.length,
  };
}

/** 「全奥克兰」 for Auckland; the country's own name when the region has no area. */
function areaName(country: CountryCode, area: string | undefined): string {
  if (area === "Auckland") return "全奥克兰";
  return area ? `全${area}` : COUNTRIES[country].nameZh;
}

/** The note beside the pay an employer is filling in: only a hint, never a block. */
export function belowMedianHint(rate: number | undefined, reference: PayReference): string | null {
  if (rate == null || !Number.isFinite(rate) || reference.scope === "none") return null;
  return rate < reference.median ? "低于同类职位的中位数，可能比较难招到人。" : null;
}
