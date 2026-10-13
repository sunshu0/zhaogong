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
