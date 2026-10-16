import { describe, expect, it } from "vitest";
import {
  applyServerSession,
  DEMO_BUSINESS_IDS,
  businessChoice,
  defaultBusinessChoice,
  employerSignUpHref,
  identityLabel,
  openErrorMessage,
  parseBusinessChoice,
  parseRole,
  postJobHref,
  reconcileIdentity,
  syncSessionIdentity,
  unconfirmedSwitch,
} from "@/components/seeker/identity";
import {
  clearSession,
  readSession,
  requestIdentity,
  updateIdentity,
  writeSession,
  type DemoSession,
} from "@/components/seeker/session";

const seeker: DemoSession = { email: "a@example.com", signedInAt: "2026-10-12T00:00:00Z", activeRole: "seeker" };
const both: DemoSession = { ...seeker, employerId: "e4", employerName: "悦美发型工作室" };

describe("parseRole", () => {
  it("reads ?role=employer and treats anything else as a job seeker", () => {
    expect(parseRole("employer")).toBe("employer");
    expect(parseRole(["employer", "seeker"])).toBe("employer");
    for (const other of [undefined, "", "seeker", "admin"]) expect(parseRole(other)).toBe("seeker");
  });
});

describe("parseBusinessChoice", () => {
  it("accepts one of the demo businesses", () => {
    expect(DEMO_BUSINESS_IDS).toEqual(["e1", "e2", "e4"]);
    expect(parseBusinessChoice({ kind: "existing", employerId: "e2" }, "NZ")).toEqual({
      ok: true,
      choice: { kind: "existing", employerId: "e2" },
    });
  });

  it("refuses any other existing business, so nobody can take over a real employer", () => {
    for (const id of ["e3", "e7", "", 4]) {
      expect(parseBusinessChoice({ kind: "existing", employerId: id }, "NZ")).toEqual({
        ok: false,
        error: "请选择一家店",
      });
    }
  });

  it("accepts a new business with a name and a known region, trimming the name", () => {
    expect(parseBusinessChoice({ kind: "new", name: "  老王面馆 ", regionId: "akl-cbd" }, "NZ")).toEqual({
      ok: true,
      choice: { kind: "new", name: "老王面馆", regionId: "akl-cbd" },
    });
  });

  it("asks for a name and a region for a new business", () => {
    expect(parseBusinessChoice({ kind: "new", name: " ", regionId: "akl-cbd" }, "NZ")).toEqual({
      ok: false,
      error: "请填写店名",
    });
    expect(parseBusinessChoice({ kind: "new", name: "店".repeat(41), regionId: "akl-cbd" }, "NZ")).toEqual({
      ok: false,
      error: "店名最多 40 个字",
    });
    expect(parseBusinessChoice({ kind: "new", name: "老王面馆", regionId: "akl-nowhere" }, "NZ")).toEqual({
      ok: false,
      error: "请选择地区",
    });
    expect(parseBusinessChoice(null, "NZ")).toEqual({ ok: false, error: "请选择一家店" });
  });
});

describe("businessChoice", () => {
  const shop = (id: string, claimed: boolean) => ({ id, claimed });

  it("keeps what was picked while it can still go through", () => {
    expect(businessChoice("e2", [shop("e1", false), shop("e2", false)])).toBe("e2");
    expect(businessChoice("new", [shop("e1", false)])).toBe("new");
  });

  it("moves on when the picked shop is bound in the meantime (#66), or is no longer listed", () => {
    expect(businessChoice("e2", [shop("e1", true), shop("e2", true), shop("e4", false)])).toBe("e4");
    expect(businessChoice("e2", [shop("e1", true), shop("e2", true)])).toBe("new");
    expect(businessChoice("e9", [shop("e1", false)])).toBe("e1");
  });
});

describe("defaultBusinessChoice", () => {
  const shop = (id: string, claimed: boolean) => ({ id, claimed });

  it("picks the first demo shop nobody has bound yet", () => {
    expect(defaultBusinessChoice([shop("e1", false), shop("e2", false)])).toBe("e1");
    expect(defaultBusinessChoice([shop("e1", true), shop("e2", true), shop("e4", false)])).toBe("e4");
  });

  it("falls back to a new business when every demo shop is bound, or there are none", () => {
    expect(defaultBusinessChoice([shop("e1", true), shop("e2", true), shop("e4", true)])).toBe("new");
    expect(defaultBusinessChoice([])).toBe("new");
  });
});

describe("where 发布招聘 goes", () => {
  it("straight to posting when the account has an employer identity", () => {
    expect(postJobHref(both)).toBe("/employer/post");
    expect(postJobHref({ ...both, activeRole: "employer" })).toBe("/employer/post");
  });

  it("to the employer sign-up step otherwise, signed in or not", () => {
    expect(postJobHref(seeker)).toBe("/login?role=employer&next=%2Femployer%2Fpost");
    expect(postJobHref(null)).toBe("/login?role=employer&next=%2Femployer%2Fpost");
    expect(employerSignUpHref("/employer/jobs")).toBe("/login?role=employer&next=%2Femployer%2Fjobs");
  });
});

describe("labels and messages", () => {
  it("names the active identity", () => {
    expect(identityLabel(seeker)).toBe("求职者");
    expect(identityLabel(both)).toBe("求职者");
    expect(identityLabel({ ...both, activeRole: "employer" })).toBe("雇主 · 悦美发型工作室");
  });

  it("explains why an employer identity could not be opened", () => {
    expect(openErrorMessage("taken")).toContain("已经有团队在用了");
    expect(openErrorMessage("banned")).toContain("停用");
    expect(openErrorMessage("no_employer")).toContain("找不到");
    expect(openErrorMessage("already_employer")).toContain("已经");
  });
});

describe("reconcileIdentity", () => {
  const server = { email: "a@example.com", employer: { id: "e4", name: "悦美发型工作室" } };

  it("takes the business from the server and keeps the identity the user chose", () => {
    expect(reconcileIdentity("employer", server)).toEqual({ activeRole: "employer", employer: server.employer });
    expect(reconcileIdentity("seeker", server)).toEqual({ activeRole: "seeker", employer: server.employer });
  });

  it("falls back to job seeker when the server has no business (never opened, banned, or edited in the browser)", () => {
    expect(reconcileIdentity("employer", { email: "a@example.com" })).toEqual({ activeRole: "seeker" });
  });
});

describe("delayed account synchronization", () => {
  const employer = { id: "e4", name: "悦美发型工作室" };
  const now = new Date("2026-10-12T00:00:00Z");

  function setup(activeRole: "seeker" | "employer" = "seeker") {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
    const requested = writeSession(storage, "a@example.com", now, { activeRole, employer });
    return { storage, requested };
  }

  it.each(["seeker", "employer"] as const)("keeps a newer switch to %s", (activeRole) => {
    const { storage, requested } = setup(activeRole === "seeker" ? "employer" : "seeker");
    updateIdentity(storage, { activeRole, employer });
    syncSessionIdentity(storage, requested, { employer });
    expect(readSession(storage)?.activeRole).toBe(activeRole);
  });

  it("keeps a newer switch marked as waiting for the server, so it is sent again if lost", () => {
    const { storage } = setup("employer");
    const older = requestIdentity(storage, { activeRole: "seeker", employer })!;
    const newer = requestIdentity(storage, { activeRole: "employer", employer })!;
    syncSessionIdentity(storage, older, { employer });
    expect(readSession(storage)).toEqual(newer);
    // Its own answer clears the mark.
    syncSessionIdentity(storage, newer, { employer });
    expect(readSession(storage)).not.toHaveProperty("switching");
  });

  it("still removes an employer identity the server no longer recognizes", () => {
    const { storage, requested } = setup("employer");
    syncSessionIdentity(storage, requested, {});
    expect(readSession(storage)?.activeRole).toBe("seeker");
    expect(readSession(storage)?.employerId).toBeUndefined();
  });

  it("ignores a lookup from before a new employer was registered", () => {
    const { storage } = setup();
    const requested = writeSession(storage, "a@example.com", now);
    updateIdentity(storage, { activeRole: "employer", employer });
    syncSessionIdentity(storage, requested, {});
    expect(readSession(storage)?.employerId).toBe(employer.id);
    expect(readSession(storage)?.activeRole).toBe("employer");
  });

  it("cannot recreate a signed-out session or modify another account", () => {
    const { storage, requested } = setup();
    clearSession(storage);
    syncSessionIdentity(storage, requested, { employer });
    expect(readSession(storage)).toBeNull();
    const other = writeSession(storage, "b@example.com", now);
    syncSessionIdentity(storage, requested, { employer });
    expect(readSession(storage)).toEqual(other);
  });

  it("ignores a previous login of the same account", () => {
    const { storage, requested } = setup();
    const current = writeSession(storage, requested.email, new Date(now.getTime() + 1000));
    syncSessionIdentity(storage, requested, { employer });
    expect(readSession(storage)).toEqual(current);
  });
});

describe("unconfirmedSwitch (a switch lost when the page was left before it reached the server)", () => {
  const switching: DemoSession = { ...both, activeRole: "employer", switching: "employer" };
  const employer = { id: "e4", name: "悦美发型工作室" };

  it("sends the switch again when the server still has the other identity", () => {
    expect(unconfirmedSwitch(switching, { email: "a@example.com", activeRole: "seeker", employer })).toBe("employer");
  });

  it("sends nothing once the server has it, without a pending switch, or for another or no server session", () => {
    expect(unconfirmedSwitch(switching, { email: "a@example.com", activeRole: "employer", employer })).toBeNull();
    expect(unconfirmedSwitch(both, { email: "a@example.com", activeRole: "employer", employer })).toBeNull();
    expect(unconfirmedSwitch(switching, { email: "b@example.com", activeRole: "seeker" })).toBeNull();
    expect(unconfirmedSwitch(switching, null)).toBeNull();
    expect(unconfirmedSwitch(null, { email: "a@example.com", activeRole: "seeker" })).toBeNull();
  });
});

describe("applyServerSession (A12-1: the server's session is the truth, the browser keeps a copy)", () => {
  const employer = { id: "e4", name: "悦美发型工作室" };
  const t0 = new Date("2026-10-15T00:00:00Z");
  const t1 = new Date("2026-10-15T01:00:00Z");

  function memory() {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    };
  }

  it("clears a copy the server has no session for (signed out, expired, or written by hand)", () => {
    const storage = memory();
    const forged = writeSession(storage, "a@example.com", t0, { activeRole: "employer", employer });
    expect(applyServerSession(storage, forged, null, t1)).toBeNull();
    expect(readSession(storage)).toBeNull();
  });

  it("restores the copy from the server's session, keeping when it started", () => {
    const storage = memory();
    expect(applyServerSession(storage, null, { email: "a@example.com", activeRole: "seeker" }, t1)).toEqual({
      email: "a@example.com",
      signedInAt: t1.toISOString(),
      activeRole: "seeker",
    });
    const copy = readSession(storage)!;
    const server = { email: "a@example.com", activeRole: "employer" as const, employer };
    expect(applyServerSession(storage, copy, server, new Date("2026-10-16T00:00:00Z"))).toEqual({
      ...copy,
      activeRole: "employer",
      employerId: "e4",
      employerName: "悦美发型工作室",
    });
  });

  it("replaces a copy of another account with the server's", () => {
    const storage = memory();
    const other = writeSession(storage, "b@example.com", t0);
    expect(applyServerSession(storage, other, { email: "a@example.com", activeRole: "seeker" }, t1)?.email).toBe(
      "a@example.com",
    );
  });

  it("ignores an answer to a request made before a switch of identity, keeping the switch to send", () => {
    const storage = memory();
    const before = writeSession(storage, "a@example.com", t0, { activeRole: "seeker", employer });
    const switched = requestIdentity(storage, { activeRole: "employer", employer })!;
    const late = { email: "a@example.com", activeRole: "seeker" as const, employer };
    expect(applyServerSession(storage, before, late, t1)).toEqual(switched);
    expect(readSession(storage)).toEqual(switched);
  });

  it("ignores an answer to a request made before the copy changed (a sign-in or sign-out in between)", () => {
    const storage = memory();
    const before = null;
    const signedIn = writeSession(storage, "a@example.com", t1);
    expect(applyServerSession(storage, before, null, t1)).toEqual(signedIn);
    expect(readSession(storage)).toEqual(signedIn);
  });
});
