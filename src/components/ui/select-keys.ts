// The keyboard of Select's option list (Round 19), as the WAI-ARIA listbox pattern has it: arrows move without
// wrapping, Home and End jump, Enter or Space picks, Esc and Tab close, and typing a letter jumps to the next option
// starting with it. Pure, for the component and its test.

export type ListboxAction = { move: number } | { pick: number } | { close: true } | null;

export function listboxKey(key: string, active: number, count: number): ListboxAction {
  if (count === 0) return key === "Escape" || key === "Tab" ? { close: true } : null;
  switch (key) {
    case "ArrowDown":
      return { move: Math.min(active + 1, count - 1) };
    case "ArrowUp":
      return { move: Math.max(active - 1, 0) };
    case "Home":
      return { move: 0 };
    case "End":
      return { move: count - 1 };
    case "Enter":
    case " ":
      return active >= 0 ? { pick: active } : null;
    case "Escape":
    case "Tab":
      return { close: true };
    default:
      return null;
  }
}

/** The next option after `active` whose label starts with the typed character (case-insensitive), or -1. */
export function typeAhead(labels: string[], typed: string, active: number): number {
  const char = typed.toLocaleLowerCase();
  if (typed.length !== 1 || !char.trim()) return -1;
  for (let step = 1; step <= labels.length; step++) {
    const index = (active + step) % labels.length;
    if (labels[index].toLocaleLowerCase().startsWith(char)) return index;
  }
  return -1;
}

/** What the closed Select shows: the chosen option's label, or the placeholder when nothing (or nothing known) is. */
export function shownLabel(options: { value: string; label: string }[], value: string, placeholder: string): string {
  return options.find((option) => option.value === value)?.label ?? placeholder;
}
