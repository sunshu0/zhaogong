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

/**
 * A staff account (ADR 0043): an admin (named in the server's configuration) or a moderator. It is for moderating
 * only, so the interface offers it nothing else.
 */
export type StaffRole = "admin" | "moderator";

export interface DemoSession {
  email: string;
  signedInAt: string;
  activeRole: ActiveRole;
  /** The account's business, as the server last confirmed it. */
  employerId?: string;
  employerName?: string;
  /** Set while a switch to this identity has not been confirmed by the server; the next page load sends it again. */
  switching?: ActiveRole;
  /** A staff account, as the server last said (ADR 0043); corrected on every page load like the rest. */
  staff?: StaffRole;
}

/** What the server says about an account, and which identity to use. */
export interface SessionIdentity {
  activeRole: ActiveRole;
  employer?: { id: string; name: string };
  /** What the server says about the staff role: null for none; left out to keep what the copy has. */
  staff?: StaffRole | null;
}

export const SESSION_KEY = "zhaogong:session";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * A sign-in code as typed or pasted, cleaned (#290): full-width digits (a Chinese input method's １２３) become ASCII,
 * and the spaces, dashes and dots a mail or text message may put in it ("123 456", "123-456") go. The browser and
 * the server both clean it before checking, so what is checked is what is verified.
 */
export function normalizeCode(code: string): string {
  return code
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-.·－]/g, "");
}

export function isValidCode(code: string): boolean {
  return /^[0-9]{6}$/.test(normalizeCode(code));
}

/** A stand-in origin: a `next` path that resolves anywhere else would leave the site. */
const ONLY_HERE = "https://zhaogong.invalid";

/** Where to go after signing in: a path on this site, never another origin or the login page itself; `fallback` otherwise. */
export function safeNext(next: string | string[] | undefined, fallback = "/jobs"): string {
  const path = Array.isArray(next) ? next[0] : next;
  // Browsers drop tabs and line breaks from a URL and read a backslash as a slash, so /<tab>/evil.example would
  // become //evil.example (security review): none of those anywhere, and the path must stay on this origin.
  if (!path || !path.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(path)) return fallback;
  if (!URL.canParse(path, ONLY_HERE) || new URL(path, ONLY_HERE).origin !== ONLY_HERE) return fallback;
  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/login/")) return fallback;
  return path;
}

/**
 * Where a signed-in visit to /login?next=… goes straight on to (#109), or null to show the page: only a path on
 * this site, and not while the address asks for the other identity (开通雇主身份, or 申请 as a job seeker while
 * signed in as an employer), which the page itself handles.
 */
export function nextForSignedIn(
  next: string | string[] | undefined,
  role: string | string[] | undefined,
  activeRole: ActiveRole,
): string | null {
  const wanted = Array.isArray(role) ? role[0] : role;
  if (wanted === "employer" || (wanted !== undefined && wanted !== activeRole)) return null;
  return safeNext(next, "") || null;
}

export function parseSession(raw: string | null): DemoSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { email, signedInAt, activeRole, employerId, employerName, switching, staff } = value as Record<
      string,
      unknown
    >;
    if (typeof email !== "string" || !isValidEmail(email) || typeof signedInAt !== "string") return null;
    const session: DemoSession = { email, signedInAt, activeRole: "seeker" };
    if (typeof employerId === "string" && employerId && typeof employerName === "string") {
      session.employerId = employerId;
      session.employerName = employerName;
      // An employer session needs a business; anything else (old sessions included) is a job seeker.
      if (activeRole === "employer") session.activeRole = "employer";
    }
    if (switching === session.activeRole) session.switching = session.activeRole;
    if (staff === "admin" || staff === "moderator") session.staff = staff;
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
  if (identity.staff) session.staff = identity.staff;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/**
 * Changes the identity of the signed-in session, keeping the email and sign-in time, and the staff role unless the
 * identity says (from the server) what it is now.
 */
export function updateIdentity(storage: StorageLike, identity: SessionIdentity): DemoSession | null {
  const current = readSession(storage);
  if (!current) return null;
  const staff = identity.staff === undefined ? current.staff : identity.staff;
  return writeSession(storage, current.email, new Date(current.signedInAt), { ...identity, staff });
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
