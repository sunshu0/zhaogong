/** A field's border colour beyond the plain one: a value is missing or unclear (`warn`), or not allowed (`danger`). */
export type FieldTone = "warn" | "danger";

const TONE_BORDERS: Record<FieldTone, string> = { warn: "border-warn", danger: "border-danger" };

/** The border of a field: grey (darker on hover), or the tone's colour. Select's trigger uses it too. */
export function fieldBorder(tone?: FieldTone) {
  return tone ? TONE_BORDERS[tone] : "border-border hover:border-muted";
}

/**
 * Round 19 text inputs and textareas (`multiline`): 44px high (a textarea grows instead), the controls' 12px corners,
 * a brand ring on focus. 16px text, so phones do not zoom in when it is focused.
 */
export function inputClass({ tone, multiline = false }: { tone?: FieldTone; multiline?: boolean } = {}) {
  return [
    "w-full rounded-control border bg-surface px-3 text-base outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/30",
    multiline ? "min-h-24 py-2" : "h-11",
    fieldBorder(tone),
  ].join(" ");
}
