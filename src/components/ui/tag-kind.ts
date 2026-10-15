/** Four tag colours with fixed meanings (Round 11): urgent = danger, perks = ok, visa = brand, everything else grey. */
export type TagKind = "urgent" | "perk" | "visa" | "neutral";

export const TAG_STYLES: Record<TagKind, string> = {
  urgent: "bg-danger-soft text-danger",
  perk: "bg-ok-soft text-ok",
  visa: "bg-brand-soft text-brand",
  neutral: "bg-neutral-soft text-muted",
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
