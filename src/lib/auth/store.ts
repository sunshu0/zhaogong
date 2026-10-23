// Where sign-in codes and sessions are kept: the database by default, the in-memory store for tests. One
// interface, so codes.ts and sessions.ts do not care which. Server only.
import { databaseAuthStore } from "@/db/auth-store";
import type { ActiveRole } from "@/components/seeker/session";

/** One live code per email: its HMAC, when it expires, wrong tries so far, when it was sent. */
export interface SignInCodeRow {
  email: string;
  codeHash: string;
  expiresAt: string;
  attempts: number;
  createdAt: string;
}

/** A session: the SHA-256 of the cookie's token (never the token), the account and its active identity. */
export interface SessionRow {
  id: string;
  email: string;
  activeRole: ActiveRole;
  createdAt: string;
  expiresAt: string;
}

export interface AuthStore {
  getCode(email: string): Promise<SignInCodeRow | undefined>;
  /** Inserts or replaces the email's code. */
  putCode(row: SignInCodeRow): Promise<void>;
  setCodeAttempts(email: string, attempts: number): Promise<void>;
  /**
   * Counts one try on the email's code in one step, only while it has tries left (fewer than `max`) and has not
   * expired at `now`; the row as counted, or undefined when no try was left. Parallel guesses each get their own try.
   */
  takeCodeAttempt(email: string, max: number, now: string): Promise<SignInCodeRow | undefined>;
  /** Deletes the email's code only if it is still this one (`codeHash`); whether it did. A code works once. */
  useCode(email: string, codeHash: string): Promise<boolean>;
  deleteCode(email: string): Promise<void>;
  /**
   * Counts one under `key` in one step, only while the count is below `max` (ADR 0033); whether it counted. The row
   * is made on the first count and may go at `expiresAt`.
   */
  takeLimit(key: string, max: number, expiresAt: string): Promise<boolean>;
  /** Deletes the counts whose window has ended at `now`. */
  clearEndedLimits(now: string): Promise<void>;
  /** Deletes the codes that expired at or before `before` (security review H). */
  clearExpiredCodes(before: string): Promise<void>;
  /** Deletes the sessions that have expired at `now` (security review H). */
  clearExpiredSessions(now: string): Promise<void>;
  getSession(id: string): Promise<SessionRow | undefined>;
  insertSession(row: SessionRow): Promise<void>;
  setSessionRole(id: string, activeRole: ActiveRole): Promise<void>;
  deleteSession(id: string): Promise<void>;
}

/** Kept in the server's memory (tests): a restart forgets everything. */
export function memoryAuthStore(): AuthStore & {
  codes: Map<string, SignInCodeRow>;
  sessions: Map<string, SessionRow>;
  limits: Map<string, { count: number; expiresAt: string }>;
} {
  const codes = new Map<string, SignInCodeRow>();
  const sessions = new Map<string, SessionRow>();
  const limits = new Map<string, { count: number; expiresAt: string }>();
  return {
    codes,
    sessions,
    limits,
    async getCode(email) {
      const row = codes.get(email);
      return row && { ...row };
    },
    async putCode(row) {
      codes.set(row.email, { ...row });
    },
    async setCodeAttempts(email, attempts) {
      const row = codes.get(email);
      if (row) row.attempts = attempts;
    },
    async takeCodeAttempt(email, max, now) {
      const row = codes.get(email);
      if (!row || row.attempts >= max || row.expiresAt <= now) return undefined;
      row.attempts += 1;
      return { ...row };
    },
    async useCode(email, codeHash) {
      return codes.get(email)?.codeHash === codeHash && codes.delete(email);
    },
    async deleteCode(email) {
      codes.delete(email);
    },
    async takeLimit(key, max, expiresAt) {
      const row = limits.get(key) ?? { count: 0, expiresAt };
      if (row.count >= max) return false;
      limits.set(key, { ...row, count: row.count + 1 });
      return true;
    },
    async clearEndedLimits(now) {
      for (const [key, row] of limits) if (row.expiresAt <= now) limits.delete(key);
    },
    async clearExpiredCodes(before) {
      for (const [email, row] of codes) if (row.expiresAt <= before) codes.delete(email);
    },
    async clearExpiredSessions(now) {
      for (const [id, row] of sessions) if (row.expiresAt <= now) sessions.delete(id);
    },
    async getSession(id) {
      const row = sessions.get(id);
      return row && { ...row };
    },
    async insertSession(row) {
      sessions.set(row.id, { ...row });
    },
    async setSessionRole(id, activeRole) {
      const row = sessions.get(id);
      if (row) row.activeRole = activeRole;
    },
    async deleteSession(id) {
      sessions.delete(id);
    },
  };
}

// The database (#8, src/db/auth-store.ts): codes and sessions survive a restart. Tests may swap in the memory store.
let current: AuthStore = databaseAuthStore() satisfies AuthStore;

export function authStore(): AuthStore {
  return current;
}

/** Tests: start from an empty store (or a given one). */
export function setAuthStoreForTests(store: AuthStore = memoryAuthStore()): AuthStore {
  current = store;
  return store;
}
