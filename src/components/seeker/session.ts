// Demo sign-in for the whole site. Any email and any six-digit code sign in (or sign up: the server creates
// the account on first use); the session lives in the browser's localStorage. An account can look for work
// and can also have an employer identity for one business; the session remembers which one is active and
// the business the server confirmed. That copy is for the interface only: anything that writes checks the
// account on the server. The functions take the storage as an argument so they can be unit-tested;
// components use the hooks in session-client.ts.

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type ActiveRole = "seeker" | "employer";

export interface DemoSession {
  email: string;
  signedInAt: string;
  activeRole: ActiveRole;
  /** The account's business, as the server last confirmed it. */
  employerId?: string;
  employerName?: string;
  /** Set while a switch to this identity has not been confirmed by the server; the next page load sends it again. */
  switching?: ActiveRole;
}

/** What the server says about an account, and which identity to use. */
export interface SessionIdentity {
  activeRole: ActiveRole;
  employer?: { id: string; name: string };
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

/** Where to go after signing in: a path on this site, never another origin or the login page itself; `fallback` otherwise. */
export function safeNext(next: string | string[] | undefined, fallback = "/jobs"): string {
  const path = Array.isArray(next) ? next[0] : next;
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/login/")) return fallback;
  return path;
}

export function parseSession(raw: string | null): DemoSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { email, signedInAt, activeRole, employerId, employerName, switching } = value as Record<string, unknown>;
    if (typeof email !== "string" || !isValidEmail(email) || typeof signedInAt !== "string") return null;
    const session: DemoSession = { email, signedInAt, activeRole: "seeker" };
    if (typeof employerId === "string" && employerId && typeof employerName === "string") {
      session.employerId = employerId;
      session.employerName = employerName;
      // An employer session needs a business; anything else (old sessions included) is a job seeker.
      if (activeRole === "employer") session.activeRole = "employer";
    }
    if (switching === session.activeRole) session.switching = session.activeRole;
    return session;
  } catch {
    return null;
  }
}

export function readSession(storage: StorageLike): DemoSession | null {
  return parseSession(storage.getItem(SESSION_KEY));
}

export function writeSession(
  storage: StorageLike,
  email: string,
  now = new Date(),
  identity: SessionIdentity = { activeRole: "seeker" },
): DemoSession {
  const session: DemoSession = { email: normalizeEmail(email), signedInAt: now.toISOString(), activeRole: "seeker" };
  if (identity.employer) {
    session.employerId = identity.employer.id;
    session.employerName = identity.employer.name;
    session.activeRole = identity.activeRole;
  }
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/** Changes the identity of the signed-in session, keeping the email and sign-in time. */
export function updateIdentity(storage: StorageLike, identity: SessionIdentity): DemoSession | null {
  const current = readSession(storage);
  if (!current) return null;
  return writeSession(storage, current.email, new Date(current.signedInAt), identity);
}

/** Changes the identity at once and marks it unconfirmed until the server's answer is written (setIdentity). */
export function requestIdentity(storage: StorageLike, identity: SessionIdentity): DemoSession | null {
  const session = updateIdentity(storage, identity);
  if (!session) return null;
  const marked: DemoSession = { ...session, switching: session.activeRole };
  storage.setItem(SESSION_KEY, JSON.stringify(marked));
  return marked;
}

export function clearSession(storage: StorageLike): void {
  storage.removeItem(SESSION_KEY);
}
