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
  deleteCode(email: string): Promise<void>;
  getSession(id: string): Promise<SessionRow | undefined>;
  insertSession(row: SessionRow): Promise<void>;
  setSessionRole(id: string, activeRole: ActiveRole): Promise<void>;
  deleteSession(id: string): Promise<void>;
}

/** Kept in the server's memory (tests): a restart forgets everything. */
export function memoryAuthStore(): AuthStore & {
  codes: Map<string, SignInCodeRow>;
  sessions: Map<string, SessionRow>;
} {
  const codes = new Map<string, SignInCodeRow>();
  const sessions = new Map<string, SessionRow>();
  return {
    codes,
    sessions,
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
    async deleteCode(email) {
      codes.delete(email);
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
