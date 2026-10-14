import { normalizeEmail, type DemoSession } from "@/components/seeker/session";

/** Business identity is included so a replacement business cannot inherit old conversations. */
export function identityScope(session: DemoSession | null): string {
  return session
    ? JSON.stringify([
        normalizeEmail(session.email),
        session.activeRole,
        session.activeRole === "employer" ? session.employerId : null,
      ])
    : "guest";
}

export function parseIdentityMap<T>(
  raw: string | null,
  parseValue: (value: unknown) => T | undefined,
): Record<string, T> {
  try {
    const value: unknown = JSON.parse(raw ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, entry]) => {
        const parsed = parseValue(entry);
        return parsed === undefined ? [] : [[key, parsed]];
      }),
    );
  } catch {
    return {};
  }
}

/**
 * Version of the per-identity data kept in the browser (chat, profile, notifications). Stored as
 * `{ version, identities: { [scope]: entry } }`; data from before versioning is a bare `{ [scope]: entry }` map.
 */
export const LOCAL_DATA_VERSION = 2;

/** The role a stored scope belongs to; older data used a bare email for the job-seeker identity. */
export function scopeRole(scope: string): "seeker" | "employer" | undefined {
  if (!scope.startsWith("[")) return scope.includes("@") ? "seeker" : undefined;
  try {
    const identity: unknown = JSON.parse(scope);
    if (!Array.isArray(identity) || identity.length !== 3 || typeof identity[0] !== "string") return undefined;
    return identity[1] === "seeker" || identity[1] === "employer" ? identity[1] : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads a versioned identity map. Entries that fail `parse` are dropped one by one, never the whole map.
 * Unversioned data goes through `parse` with `legacy` set, and a bare-email key moves to that account's
 * job-seeker scope (unless the scope has its own entry). A newer version than this code knows reads as empty.
 */
export function parseStoredIdentities<T>(
  raw: string | null,
  parse: (value: unknown, context: { scope: string; legacy: boolean }) => T | undefined,
): Record<string, T> {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const legacy = !("version" in record);
  if (!legacy && record.version !== LOCAL_DATA_VERSION) return {};
  const entries = legacy ? record : record.identities;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) return {};

  const result: Record<string, T> = {};
  const moved: [string, T][] = [];
  for (const [key, entry] of Object.entries(entries)) {
    const scope = legacy && !key.startsWith("[") && key.includes("@") ? seekerScopeOf(key) : key;
    const parsed = parse(entry, { scope, legacy });
    if (parsed === undefined) continue;
    if (scope === key) result[key] = parsed;
    else moved.push([scope, parsed]);
  }
  for (const [scope, parsed] of moved) if (!(scope in result)) result[scope] = parsed;
  return result;
}

export function stringifyStoredIdentities<T>(identities: Record<string, T>): string {
  return JSON.stringify({ version: LOCAL_DATA_VERSION, identities });
}

function seekerScopeOf(email: string): string {
  return JSON.stringify([normalizeEmail(email), "seeker", null]);
}
