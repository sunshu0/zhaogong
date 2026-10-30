// How many jobs each section of external jobs has now (user feedback 10-30 #4): a section with none is not put
// forward in the navigation as if it had some; it says 筹备中 and comes last. Counted from the jobs shown, kept a
// few minutes (the navigation asks on every page). Server only; call it after connection().
import { cookies } from "next/headers";
import { listExternalJobs } from "@/db/external-jobs";
import { filterExternalJobs, type ExternalSection } from "@/lib/external-jobs/filter";
import { isTestBuild } from "@/lib/test-build";

export const SECTIONS: readonly ExternalSection[] = ["internship", "professional"];
const KEEP_MS = 5 * 60_000;

/** The browser tests' data has jobs in both; this cookie empties the named ones (e2e/demo-sections.spec.ts). */
export const TEST_EMPTY_COOKIE = "zg_e2e_empty_sections";

let kept: { at: number; counts: Record<ExternalSection, number> } | undefined;

/** The jobs in each section. Pure, for the tests. */
export function countSections(shown: Parameters<typeof filterExternalJobs>[0]): Record<ExternalSection, number> {
  return {
    internship: filterExternalJobs(shown, "internship", {}).length,
    professional: filterExternalJobs(shown, "professional", {}).length,
  };
}

/** The sections with no job now, in SECTIONS' order. */
export async function preparingSections(now = new Date()): Promise<ExternalSection[]> {
  if (!kept || now.getTime() - kept.at > KEEP_MS || now.getTime() < kept.at)
    kept = { at: now.getTime(), counts: countSections(await listExternalJobs({ shownAt: now })) };
  const counts = { ...kept.counts };
  if (isTestBuild())
    for (const name of ((await cookies()).get(TEST_EMPTY_COOKIE)?.value ?? "").split(","))
      if (name === "internship" || name === "professional") counts[name] = 0;
  return SECTIONS.filter((section) => counts[section] === 0);
}

/** For tests: the next call counts again. */
export function resetSectionCountsForTests(): void {
  kept = undefined;
}
