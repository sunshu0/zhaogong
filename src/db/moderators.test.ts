import { afterEach, describe, expect, it, vi } from "vitest";
import {
  grantModerator,
  isModerator,
  listModeratorChanges,
  listModerators,
  revokeModerator,
  staffRole,
} from "@/db/moderators";
import { ensureAccount, openEmployerIdentity } from "@/lib/data";
import { createJobAlert } from "@/db/job-alerts";
import { saveJob } from "@/db/saved-jobs";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("moderators (#50)", () => {
  it("grants the role to an existing account only, once", async () => {
    expect(await grantModerator("no.account@example.com", null)).toBe("no_account");
    await ensureAccount("first.mod@example.com");
    expect(await isModerator("first.mod@example.com")).toBe(false);
    expect(await grantModerator(" First.Mod@Example.com ", null)).toBe("granted"); // the address as typed
    expect(await grantModerator("first.mod@example.com", null)).toBe("already");
    expect(await isModerator("FIRST.MOD@example.com")).toBe(true);
  });

  it("lists moderators oldest first, with who added them", async () => {
    await ensureAccount("second.mod@example.com");
    await grantModerator("second.mod@example.com", "first.mod@example.com");
    const list = await listModerators();
    const emails = list.map((m) => m.email);
    expect(emails.indexOf("first.mod@example.com")).toBeLessThan(emails.indexOf("second.mod@example.com"));
    expect(list.find((m) => m.email === "second.mod@example.com")).toMatchObject({
      grantedBy: "first.mod@example.com",
    });
    expect(list.find((m) => m.email === "first.mod@example.com")?.grantedBy).toBeNull();
  });

  it("revokes, down to none (ADR 0043: the admins are always there)", async () => {
    expect(await revokeModerator("nobody.special@example.com")).toBe("not_moderator");
    for (const m of await listModerators()) expect(await revokeModerator(m.email)).toBe("revoked");
    expect(await listModerators()).toHaveLength(0);
    expect(await isModerator("first.mod@example.com")).toBe(false);
  });
});

describe("staff accounts (ADR 0043)", () => {
  it("knows the admins from ZHAOGONG_ADMIN_EMAILS, who are moderators that cannot be granted or revoked", async () => {
    vi.stubEnv("ZHAOGONG_ADMIN_EMAILS", " Boss.Admin@example.com ,other.admin@example.com,");
    await ensureAccount("boss.admin@example.com");
    expect(await staffRole("boss.admin@example.com")).toBe("admin");
    expect(await isModerator("BOSS.ADMIN@example.com")).toBe(true);
    expect(await grantModerator("boss.admin@example.com", null)).toBe("already");
    expect(await revokeModerator("boss.admin@example.com", null)).toBe("admin");
    expect(await staffRole("boss.admin@example.com")).toBe("admin");
    vi.stubEnv("ZHAOGONG_ADMIN_EMAILS", "");
    expect(await staffRole("boss.admin@example.com")).toBeNull();
  });

  it("grants only an address with no job seeker's or employer's data", async () => {
    const saver = "has.saved@example.com";
    await ensureAccount(saver);
    await saveJob(saver, "j1");
    expect(await grantModerator(saver, "boss.admin@example.com")).toBe("has_data");
    const alerter = "has.alert@example.com";
    await ensureAccount(alerter);
    await createJobAlert(alerter, { name: "厨房", country: "NZ", query: "industry=hospitality" });
    expect(await grantModerator(alerter, null)).toBe("has_data");
    const hirer = "has.business@example.com";
    await ensureAccount(hirer);
    expect(await openEmployerIdentity(hirer, "e2")).toMatchObject({ ok: true });
    expect(await grantModerator(hirer, null)).toBe("has_data");
    for (const email of [saver, alerter, hirer]) expect(await isModerator(email)).toBe(false);
  });

  it("records every grant and revocation, newest first, with who did it", async () => {
    const email = "recorded.mod@example.com";
    await ensureAccount(email);
    expect(await grantModerator(email, "boss.admin@example.com", new Date("2026-10-26T01:00:00Z"))).toBe("granted");
    expect(await revokeModerator(email, null, new Date("2026-10-26T02:00:00Z"))).toBe("revoked");
    // Refused ones leave nothing.
    expect(await revokeModerator(email, "boss.admin@example.com")).toBe("not_moderator");
    const mine = (await listModeratorChanges()).filter((c) => c.email === email);
    expect(mine.map(({ at, action, by }) => ({ at, action, by }))).toEqual([
      { at: "2026-10-26T02:00:00.000Z", action: "revoke", by: null },
      { at: "2026-10-26T01:00:00.000Z", action: "grant", by: "boss.admin@example.com" },
    ]);
  });
});
