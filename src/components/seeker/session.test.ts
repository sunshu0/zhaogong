import { describe, expect, it } from "vitest";
import {
  clearSession,
  isValidCode,
  isValidEmail,
  normalizeEmail,
  readSession,
  safeNext,
  writeSession,
  type StorageLike,
} from "@/components/seeker/session";

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("sign-in input", () => {
  it("accepts ordinary email addresses after trimming and lower-casing", () => {
    expect(normalizeEmail("  Li.Wei@Example.co.nz ")).toBe("li.wei@example.co.nz");
    expect(isValidEmail("li.wei@example.co.nz")).toBe(true);
    for (const bad of ["", "li", "li@", "@example.com", "li@example", "li wei@example.com"]) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });

  it("accepts any six digits as the demo code", () => {
    expect(isValidCode("123456")).toBe(true);
    expect(isValidCode(" 000000 ")).toBe(true);
    for (const bad of ["", "12345", "1234567", "12345a", "１２３４５６"]) expect(isValidCode(bad)).toBe(false);
  });
});

describe("safeNext", () => {
  it("returns to a page on this site", () => {
    expect(safeNext("/jobs/j1")).toBe("/jobs/j1");
    expect(safeNext("/?industry=retail")).toBe("/?industry=retail");
  });

  it("falls back to the home page for anything that could leave the site", () => {
    for (const bad of [undefined, "", "jobs/j1", "//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)"]) {
      expect(safeNext(bad)).toBe("/");
    }
    expect(safeNext(["/jobs/j1", "/jobs/j2"])).toBe("/jobs/j1");
  });

  it("does not send the user back to the login page", () => {
    expect(safeNext("/login?next=/jobs/j1")).toBe("/");
  });
});

describe("session storage", () => {
  it("signs in, reads back and signs out", () => {
    const storage = memoryStorage();
    expect(readSession(storage)).toBeNull();
    const session = writeSession(storage, " Li@Example.com ", new Date("2026-10-12T01:00:00Z"));
    expect(session).toEqual({ email: "li@example.com", signedInAt: "2026-10-12T01:00:00.000Z" });
    expect(readSession(storage)).toEqual(session);
    clearSession(storage);
    expect(readSession(storage)).toBeNull();
  });

  it("ignores stored values that are broken or tampered with", () => {
    const storage = memoryStorage();
    for (const raw of ["not json", "null", "{}", '{"email":"nope"}', '{"email":42}']) {
      storage.data.set("zhaogong:session", raw);
      expect(readSession(storage)).toBeNull();
    }
  });
});
