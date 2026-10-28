import { filterToQuery, type SearchParams } from "@/components/seeker/filter-query";
import type { JobFilter } from "@/lib/types";

export type JobOrder = "latest" | "recommended";

/** Ambiguous/repeated or unknown values fall back to Latest. Ordering is not an alert filter. */
export function parseJobOrder(params: SearchParams): JobOrder {
  return params.sort === "recommended" ? "recommended" : "latest";
}

/** Combines a canonical filter query (also used by chips) with a separate display order. */
export function withJobOrder(filterQuery: string, order: JobOrder): string {
  return order === "recommended" ? [filterQuery, "sort=recommended"].filter(Boolean).join("&") : filterQuery;
}

export function jobListQuery(filter: JobFilter, order: JobOrder): string {
  return withJobOrder(filterToQuery(filter), order);
}
