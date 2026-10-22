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

describe("taking a try and using a code in one statement each (security review)", () => {
  it("counts tries in the database up to the limit, only on a live code", async () => {
    await store.putCode({ ...code, email: "try@example.com" });
    const now = "2026-10-15T10:05:00.000Z";
    const taken = await Promise.all(Array.from({ length: 8 }, () => store.takeCodeAttempt("try@example.com", 5, now)));
    expect(
      taken
        .filter(Boolean)
        .map((r) => r!.attempts)
        .sort(),
    ).toEqual([1, 2, 3, 4, 5]);
    expect((await store.getCode("try@example.com"))?.attempts).toBe(5);
    await store.putCode({ ...code, email: "late@example.com" });
    expect(await store.takeCodeAttempt("late@example.com", 5, code.expiresAt)).toBeUndefined();
    expect(await store.takeCodeAttempt("nobody@example.com", 5, now)).toBeUndefined();
  });

  it("uses a code once, and only the code it was given", async () => {
    await store.putCode({ ...code, email: "use@example.com" });
    expect(await store.useCode("use@example.com", "b".repeat(64))).toBe(false);
    expect(await store.useCode("use@example.com", code.codeHash)).toBe(true);
    expect(await store.useCode("use@example.com", code.codeHash)).toBe(false);
    expect(await store.getCode("use@example.com")).toBeUndefined();
  });
});

describe("sign-in limits in the database (ADR 0033)", () => {
  it("counts up to the limit in one statement each, even when the requests come at once", async () => {
    const key = "c".repeat(64);
    const taken = await Promise.all(Array.from({ length: 12 }, () => store.takeLimit(key, 5, "2026-10-15T11:00:00Z")));
    expect(taken.filter(Boolean)).toHaveLength(5);
    expect(await store.takeLimit(key, 5, "2026-10-15T11:00:00Z")).toBe(false);
    expect(await store.takeLimit("d".repeat(64), 5, "2026-10-15T11:00:00Z")).toBe(true); // another key, its own count
  });

  it("clears only the counts whose window has ended", async () => {
    await store.takeLimit("e".repeat(64), 1, "2026-10-15T09:00:00.000Z");
    await store.takeLimit("f".repeat(64), 1, "2026-10-15T12:00:00.000Z");
    await store.clearEndedLimits("2026-10-15T10:00:00.000Z");
    expect(await store.takeLimit("e".repeat(64), 1, "2026-10-15T11:00:00.000Z")).toBe(true); // gone, so counted anew
    expect(await store.takeLimit("f".repeat(64), 1, "2026-10-15T12:00:00.000Z")).toBe(false); // kept, still full
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
