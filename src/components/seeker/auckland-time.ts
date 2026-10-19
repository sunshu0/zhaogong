// Auckland wall-clock time for interviews (#103), kept apart from interviews.ts with no imports at all: the browser
// tests import it, and Playwright's loader cannot load src/i18n/english.ts (#240: a top-level await), which
// interviews.ts reaches through its dictionary.

export const INTERVIEW_TZ = "Pacific/Auckland";

/** The Auckland calendar parts of an instant. */
export const aucklandParts = (ms: number) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: INTERVIEW_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(ms))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, Number(p.value)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute", number>;

/** Auckland's offset from UTC at an instant, in minutes. */
function offsetAt(ms: number): number {
  const p = aucklandParts(ms);
  return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(ms / 60_000) * 60_000) / 60_000;
}

/**
 * A wall-clock time in Auckland ("2026-10-20T14:30", as <input type="datetime-local"> gives it) as an instant;
 * null when it is not one, or falls in the hour skipped when daylight saving starts.
 */
export function aucklandToInstant(local: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(wall) || new Date(wall).getUTCDate() !== d || h > 23 || mi > 59) return null;
  let ms = wall - offsetAt(wall) * 60_000;
  ms = wall - offsetAt(ms) * 60_000;
  const back = aucklandParts(ms);
  if (back.hour !== h || back.minute !== mi || back.day !== d) return null;
  return new Date(ms).toISOString();
}

/** The Auckland wall-clock time of an instant, for a datetime-local field. */
export function instantToAuckland(iso: string): string {
  const p = aucklandParts(Date.parse(iso));
  const two = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${two(p.month)}-${two(p.day)}T${two(p.hour)}:${two(p.minute)}`;
}
