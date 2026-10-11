// Demo sign-in for job seekers. There is no backend yet: any email and any six-digit code sign in,
// and the session lives in the browser's localStorage. The functions take the storage as an argument
// so they can be unit-tested; components use the hooks in session-client.ts.

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface DemoSession {
  email: string;
  signedInAt: string;
}

export const SESSION_KEY = "zhaogong:session";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidCode(code: string): boolean {
  return /^[0-9]{6}$/.test(code.trim());
}

/** Where to go after signing in: a path on this site, never another origin or the login page itself. */
export function safeNext(next: string | string[] | undefined): string {
  const path = Array.isArray(next) ? next[0] : next;
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/login/")) return "/";
  return path;
}

export function parseSession(raw: string | null): DemoSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { email, signedInAt } = value as Record<string, unknown>;
    if (typeof email !== "string" || !isValidEmail(email) || typeof signedInAt !== "string") return null;
    return { email, signedInAt };
  } catch {
    return null;
  }
}

export function readSession(storage: StorageLike): DemoSession | null {
  return parseSession(storage.getItem(SESSION_KEY));
}

export function writeSession(storage: StorageLike, email: string, now = new Date()): DemoSession {
  const session = { email: normalizeEmail(email), signedInAt: now.toISOString() };
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function clearSession(storage: StorageLike): void {
  storage.removeItem(SESSION_KEY);
}
