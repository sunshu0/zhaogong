import { describe, expect, it } from "vitest";
import { databaseAuthStore } from "@/db/auth-store";
import { ensureAccount } from "@/lib/data";

const store = databaseAuthStore();
const code = {
  email: "li@example.com",
  codeHash: "a".repeat(64),
  expiresAt: "2026-10-15T10:10:00.000Z",
  attempts: 0,
  createdAt: "2026-10-15T10:00:00.000Z",
};

describe("sign-in codes in the database", () => {
  it("keeps one code per email, counts wrong tries, and forgets it", async () => {
    expect(await store.getCode(code.email)).toBeUndefined();
    await store.putCode(code);
    await store.putCode({ ...code, codeHash: "b".repeat(64) }); // a new code replaces the old one
    expect(await store.getCode(code.email)).toEqual({ ...code, codeHash: "b".repeat(64) });
    await store.setCodeAttempts(code.email, 2);
    expect((await store.getCode(code.email))?.attempts).toBe(2);
    await store.deleteCode(code.email);
    expect(await store.getCode(code.email)).toBeUndefined();
  });
});

describe("sessions in the database", () => {
  const session = {
    id: "f".repeat(64),
    email: "li@example.com",
    activeRole: "seeker" as const,
    createdAt: "2026-10-15T10:00:00.000Z",
    expiresAt: "2026-11-14T10:00:00.000Z",
  };

  it("stores a session for an existing account, switches its identity, and ends it", async () => {
    await ensureAccount(session.email);
    await store.insertSession(session);
    expect(await store.getSession(session.id)).toEqual(session);
    await store.setSessionRole(session.id, "employer");
    expect((await store.getSession(session.id))?.activeRole).toBe("employer");
    await store.deleteSession(session.id);
    expect(await store.getSession(session.id)).toBeUndefined();
  });

  it("refuses a session for an account that does not exist", async () => {
    await expect(
      store.insertSession({ ...session, id: "e".repeat(64), email: "nobody@example.com" }),
    ).rejects.toThrow();
  });
});
