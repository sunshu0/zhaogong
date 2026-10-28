// Server sessions: the cookie holds 32 random bytes; the store keeps their SHA-256 with the account and the
// active identity. The business always comes from the account (getAccountEmployer), never from the browser.
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { authStore } from "@/lib/auth/store";
import { getAccountEmployer } from "@/lib/data";
import type { Employer } from "@/lib/types";
import { isProduction, SESSION_TTL_MS, sessionCookieName } from "@/lib/auth/config";
import { normalizeEmail, type ActiveRole } from "@/components/seeker/session";

/** The bits of Next's cookie store used here; tests pass their own. */
export interface CookieJar {
  get(name: string): { name: string; value: string } | undefined;
  set(name: string, value: string, options: Record<string, unknown>): void;
  delete(name: string): void;
}

/** What the browser may know about its session (for display). */
export interface SessionView {
  email: string;
  activeRole: ActiveRole;
  employer?: { id: string; name: string };
}

export class AuthError extends Error {
  constructor(readonly code: "signed_out" | "no_employer") {
    super(code === "signed_out" ? "请先登录" : "需要先开通雇主身份");
  }
}

async function requestJar(): Promise<CookieJar> {
  return (await cookies()) as unknown as CookieJar;
}

function idOf(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction(),
    path: "/",
    expires,
    maxAge: SESSION_TTL_MS / 1000,
  };
}

function view(email: string, activeRole: ActiveRole, employer: Employer | undefined): SessionView {
  const role = activeRole === "employer" && employer ? "employer" : "seeker";
  return employer
    ? { email, activeRole: role, employer: { id: employer.id, name: employer.name } }
    : { email, activeRole: role };
}

/** Starts a session for an account that exists, with the identity asked for if the account has it. */
export async function createSession(
  email: string,
  wanted: ActiveRole,
  jar?: CookieJar,
  now = new Date(),
): Promise<SessionView> {
  const address = normalizeEmail(email);
  const employer = await getAccountEmployer(address);
  const result = view(address, wanted, employer);
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  await authStore().insertSession({
    id: idOf(token),
    email: address,
    activeRole: result.activeRole,
    createdAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });
  (jar ?? (await requestJar())).set(sessionCookieName(), token, sessionCookieOptions(expires));
  return result;
}

async function currentRow(jar: CookieJar, now: Date) {
  const token = jar.get(sessionCookieName())?.value;
  if (!token) return undefined;
  const store = authStore();
  const row = await store.getSession(idOf(token));
  if (!row) return undefined;
  if (Date.parse(row.expiresAt) <= now.getTime()) {
    await store.deleteSession(row.id);
    return undefined;
  }
  return row;
}

/** The signed-in session from the request's cookie, or null. Reads only; safe in Server Components. */
export async function getCurrentSession(jar?: CookieJar, now = new Date()): Promise<SessionView | null> {
  const row = await currentRow(jar ?? (await requestJar()), now);
  if (!row) return null;
  return view(row.email, row.activeRole, await getAccountEmployer(row.email));
}

/** Server-only: binds a browser push subscription to this exact authenticated session. Never sent to the client. */
export async function currentPushSession(
  jar?: CookieJar,
  now = new Date(),
): Promise<{ id: string; view: SessionView } | null> {
  const row = await currentRow(jar ?? (await requestJar()), now);
  return row ? { id: row.id, view: view(row.email, row.activeRole, await getAccountEmployer(row.email)) } : null;
}

export async function requireSession(jar?: CookieJar): Promise<SessionView> {
  const session = await getCurrentSession(jar);
  if (!session) throw new AuthError("signed_out");
  return session;
}

/** The signed-in account's business; for every employer Server Function. */
export async function requireEmployer(jar?: CookieJar): Promise<{ email: string; employer: Employer }> {
  const session = await requireSession(jar);
  const employer = await getAccountEmployer(session.email);
  if (!employer) throw new AuthError("no_employer");
  return { email: session.email, employer };
}

/** Switches the active identity; to employer only if the account has a business. */
export async function switchRole(role: ActiveRole, jar?: CookieJar, now = new Date()): Promise<SessionView> {
  const cookieJar = jar ?? (await requestJar());
  const row = await currentRow(cookieJar, now);
  if (!row) throw new AuthError("signed_out");
  const result = view(row.email, role, await getAccountEmployer(row.email));
  await authStore().setSessionRole(row.id, result.activeRole);
  return result;
}

export async function signOut(jar?: CookieJar): Promise<void> {
  const cookieJar = jar ?? (await requestJar());
  const token = cookieJar.get(sessionCookieName())?.value;
  if (token) await authStore().deleteSession(idOf(token));
  // Expired with the cookie's own options, not delete(name): Next's delete sends no Secure, and the browser refuses to
  // replace a __Host- cookie without it, so the cookie would stay (an empty value never signs anyone in).
  cookieJar.set(sessionCookieName(), "", { ...sessionCookieOptions(new Date(0)), maxAge: 0 });
}
