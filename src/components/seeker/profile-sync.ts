// 我的主页 between this browser and the account (#104). The server has the account's page; the browser keeps a copy
// per identity (hub-client.ts) and, per identity, what it knows of that copy: which saved version it matches and
// whether it has changes the server has not confirmed yet. Pure: the browser store and Server Functions are elsewhere.
import type { Profile } from "@/components/seeker/hub-state";

/** What this browser knows of its copy. `at`: the server's `updatedAt` the copy last matched. */
export type SyncMark = { at?: string; dirty?: boolean };

/** What to do once the server's page is known. */
export type SyncStep =
  | "same" // both have the same page
  | "take" // keep the server's page here
  | "upload" // send this browser's page
  | "ask"; // both have a different page and neither is clearly newer: the person picks

const isEmpty = (page: Partial<Profile> | undefined) => !page || Object.keys(page).length === 0;

/** The same page, field by field (the order fields were written in does not matter). */
export function samePage(a: Partial<Profile> | undefined, b: Partial<Profile> | undefined): boolean {
  return canonical(a ?? {}) === canonical(b ?? {});
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .filter((key) => (value as Record<string, unknown>)[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function syncStep(
  local: Partial<Profile> | undefined,
  server: { profile: Partial<Profile> | null; updatedAt: string | null },
  mark: SyncMark | undefined,
): SyncStep {
  if (!server.profile) return isEmpty(local) ? "same" : "upload";
  if (isEmpty(local)) return "take";
  if (samePage(local, server.profile)) return "same";
  // This copy came from the server's current page and only changed here since: this browser is newer.
  if (mark?.at && mark.at === server.updatedAt) return "upload";
  // Changed elsewhere, and nothing here waits to be saved: the server is newer.
  if (mark?.at && !mark.dirty) return "take";
  // First time this account's page meets this browser's, or both changed: only the person knows which to keep.
  return "ask";
}

/** The marks per identity, as the browser stores them. Anything unreadable is left out. */
export function parseSyncMarks(raw: string | null): Record<string, SyncMark> {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const marks: Record<string, SyncMark> = {};
  for (const [scope, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const { at, dirty } = entry as Record<string, unknown>;
    marks[scope] = { ...(typeof at === "string" ? { at } : {}), ...(dirty === true ? { dirty } : {}) };
  }
  return marks;
}
