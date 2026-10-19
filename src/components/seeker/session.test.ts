import { describe, expect, it } from "vitest";
import {
  clearSession,
  isValidCode,
  isValidEmail,
  nextForSignedIn,
  normalizeEmail,
  readSession,
  requestIdentity,
  safeNext,
  updateIdentity,
  writeSession,
  type DemoSession,
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
    // #290: what a mail, a text message or a Chinese input method gives.
    expect(isValidCode("123 456")).toBe(true);
    expect(isValidCode("123-456")).toBe(true);
    expect(isValidCode("１２３４５６")).toBe(true);
    expect(isValidCode("12345")).toBe(false);
    expect(isValidCode("12a456")).toBe(false);
    // Full-width digits used to be refused here; they are cleaned to ASCII now (#290), so they moved up.
    for (const bad of ["", "12345", "1234567", "12345a", "１２３４５"]) expect(isValidCode(bad)).toBe(false);
  });
});

describe("nextForSignedIn (#109)", () => {
  it("sends a signed-in visit to /login on to a page on this site", () => {
    expect(nextForSignedIn("/account", undefined, "seeker")).toBe("/account");
    expect(nextForSignedIn(["/me/saved", "/x"], undefined, "employer")).toBe("/me/saved");
    expect(nextForSignedIn("/jobs/j1?apply=1", "seeker", "seeker")).toBe("/jobs/j1?apply=1");
  });

  it("stays on the page without a next, for one off the site, and when another identity is asked for", () => {
    expect(nextForSignedIn(undefined, undefined, "seeker")).toBeNull();
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "/login?next=/account"])
      expect(nextForSignedIn(bad, undefined, "seeker")).toBeNull();
    expect(nextForSignedIn("/employer/post", "employer", "seeker")).toBeNull();
    expect(nextForSignedIn("/employer/post", "employer", "employer")).toBeNull();
    expect(nextForSignedIn("/jobs/j1?apply=1", "seeker", "employer")).toBeNull();
  });
});

describe("safeNext", () => {
  it("returns to a page on this site", () => {
    expect(safeNext("/jobs/j1")).toBe("/jobs/j1");
    expect(safeNext("/jobs?industry=retail")).toBe("/jobs?industry=retail");
    expect(safeNext("/")).toBe("/");
  });

  it("falls back to the job list for anything that could leave the site", () => {
    for (const bad of [
      undefined,
      "",
      "jobs/j1",
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
      "javascript:alert(1)",
    ]) {
      expect(safeNext(bad)).toBe("/jobs");
    }
    expect(safeNext(["/jobs/j1", "/jobs/j2"])).toBe("/jobs/j1");
  });

  it("does not send the user back to the login page", () => {
    expect(safeNext("/login?next=/jobs/j1")).toBe("/jobs");
  });
});

describe("session storage", () => {
  it("signs in, reads back and signs out", () => {
    const storage = memoryStorage();
    expect(readSession(storage)).toBeNull();
    const session = writeSession(storage, " Li@Example.com ", new Date("2026-10-12T01:00:00Z"));
    expect(session).toEqual({ email: "li@example.com", signedInAt: "2026-10-12T01:00:00.000Z", activeRole: "seeker" });
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

describe("identities in the session", () => {
  const at = new Date("2026-10-12T01:00:00Z");

  it("stores the active identity and the business the server confirmed", () => {
    const storage = memoryStorage();
    const session = writeSession(storage, "boss@example.com", at, {
      activeRole: "employer",
      employer: { id: "e4", name: "悦美发型工作室" },
    });
    expect(session).toEqual<DemoSession>({
      email: "boss@example.com",
      signedInAt: "2026-10-12T01:00:00.000Z",
      activeRole: "employer",
      employerId: "e4",
      employerName: "悦美发型工作室",
    });
    expect(readSession(storage)).toEqual(session);
  });

  it("reads sessions saved before identities existed as job seekers", () => {
    const storage = memoryStorage();
    storage.data.set("zhaogong:session", JSON.stringify({ email: "old@example.com", signedInAt: at.toISOString() }));
    expect(readSession(storage)).toEqual({
      email: "old@example.com",
      signedInAt: at.toISOString(),
      activeRole: "seeker",
    });
  });

  it("never treats a session as an employer without a business", () => {
    const storage = memoryStorage();
    storage.data.set(
      "zhaogong:session",
      JSON.stringify({ email: "x@example.com", signedInAt: at.toISOString(), activeRole: "employer" }),
    );
    expect(readSession(storage)?.activeRole).toBe("seeker");
    storage.data.set(
      "zhaogong:session",
      JSON.stringify({ email: "x@example.com", signedInAt: at.toISOString(), activeRole: "boss", employerId: 7 }),
    );
    expect(readSession(storage)).toEqual({
      email: "x@example.com",
      signedInAt: at.toISOString(),
      activeRole: "seeker",
    });
  });
});

describe("a switch the server has not confirmed", () => {
  const at = new Date("2026-10-12T01:00:00Z");
  const employer = { id: "e4", name: "悦美发型工作室" };

  it("is marked until the server's answer is written, and survives a page load", () => {
    const storage = memoryStorage();
    writeSession(storage, "boss@example.com", at, { activeRole: "seeker", employer });
    const requested = requestIdentity(storage, { activeRole: "employer", employer });
    expect(requested).toMatchObject({ activeRole: "employer", switching: "employer" });
    expect(readSession(storage)).toEqual(requested);
    expect(updateIdentity(storage, { activeRole: "employer", employer })).not.toHaveProperty("switching");
    expect(readSession(storage)).not.toHaveProperty("switching");
  });

  it("is dropped when it does not name the identity shown", () => {
    const storage = memoryStorage();
    storage.data.set(
      "zhaogong:session",
      JSON.stringify({
        email: "x@example.com",
        signedInAt: at.toISOString(),
        activeRole: "seeker",
        switching: "employer",
      }),
    );
    expect(readSession(storage)).not.toHaveProperty("switching");
  });

  it("needs a session", () => {
    expect(requestIdentity(memoryStorage(), { activeRole: "seeker" })).toBeNull();
  });
});

describe("safeNext with a fallback", () => {
  it("uses the given fallback for anything unsafe", () => {
    expect(safeNext(undefined, "/employer/post")).toBe("/employer/post");
    expect(safeNext("//evil.example", "/employer/post")).toBe("/employer/post");
    expect(safeNext("/employer/jobs", "/employer/post")).toBe("/employer/jobs");
  });
});
