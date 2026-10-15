/**
 * Four kinds with fixed meanings, three border colours (Round 13): urgent = danger, perks and visa = brand,
 * everything else grey. Red is kept for 急招, errors and dangerous actions.
 */
export type TagKind = "urgent" | "perk" | "visa" | "neutral";

export const TAG_STYLES: Record<TagKind, string> = {
  urgent: "border-danger font-semibold text-danger",
  perk: "border-brand/35 text-brand",
  visa: "border-brand/35 text-brand",
  neutral: "border-muted/40 text-muted",
};

const KIND_BY_LABEL: Record<string, TagKind> = {
  急招: "urgent",
  包餐: "perk",
  包住: "perk",
  包食宿: "perk",
};

/** The kind for a job tag's label: 急招 is urgent, meals and housing are perks, anything about a visa is visa. */
export function tagKindFor(label: string): TagKind {
  const kind = KIND_BY_LABEL[label];
  if (kind) return kind;
  if (/签|visa/i.test(label)) return "visa";
  return "neutral";
}
