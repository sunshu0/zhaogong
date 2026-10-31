// The job list's search (bugs-1, user feedback 10-30): the words in the box against what a job seeker would look for
// it by — its titles and descriptions, the business's name, the area (Chinese and English) and the street address.
// Pure, so the list (listJobs) and saved alerts (matchJobAlerts) search alike. Plain substring matching in code, after
// the database read: no SQL or LIKE pattern is built from the words, so % and _ are just characters.
import { AREA_ZH, regionById } from "@/config/countries";
import type { Job } from "@/lib/types";

/** At most this many words are looked for; a pasted paragraph is not a search. */
export const SEARCH_TERMS_MAX = 8;

/** Full-width letters and spaces read as their usual forms, case aside. */
const normalized = (text: string) => text.normalize("NFKC").toLowerCase();

/** The words of a search: split at any space (a Chinese full-width one too), each once. */
export function searchTerms(query: string | undefined): string[] {
  if (!query) return [];
  return [...new Set(normalized(query).split(/\s+/).filter(Boolean))].slice(0, SEARCH_TERMS_MAX);
}

/** Everything a job is found by, normalized. */
export function jobSearchText(job: Job, employerName?: string): string {
  const region = regionById(job.country, job.regionId);
  return normalized(
    [
      job.titleZh,
      job.titleEn,
      job.descriptionZh,
      job.descriptionEn,
      employerName,
      region?.nameZh,
      region?.nameEn,
      region?.area,
      region && AREA_ZH[region.area],
      job.address,
    ]
      .filter(Boolean)
      .join("\n"),
  );
}

/** Whether every word of the search is somewhere in the job (no words: it matches). */
export function matchesSearch(job: Job, query: string | undefined, employerName?: string): boolean {
  const terms = searchTerms(query);
  if (!terms.length) return true;
  const text = jobSearchText(job, employerName);
  return terms.every((term) => text.includes(term));
}
