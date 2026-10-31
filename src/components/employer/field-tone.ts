// How a field of the job form shows its state (#172): red for a problem that holds publishing, amber for a value the
// parser could not fill. The text inputs (inputClass) and the ui Select's trigger take the same tone (selectTone).
import type { Finding } from "@/lib/compliance";
import type { FieldTone } from "@/components/ui/input-class";

export type FieldState = { missing: boolean; findings: Finding[] };

/** The tone of a field: a finding other than one for review holds publishing (red); a missing value is amber. */
export function selectTone(state: FieldState): FieldTone | undefined {
  if (state.findings.some((f) => f.level !== "review")) return "danger";
  if (state.missing) return "warn";
  return undefined;
}
