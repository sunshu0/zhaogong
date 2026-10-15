import { describe, expect, it } from "vitest";
import { grantModerator, isModerator, listModerators, revokeModerator } from "@/db/moderators";
import { ensureAccount } from "@/lib/data";

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

  it("revokes, but never the last moderator", async () => {
    expect(await revokeModerator("nobody.special@example.com")).toBe("not_moderator");
    for (const m of await listModerators()) {
      if (m.email !== "first.mod@example.com") expect(await revokeModerator(m.email)).toBe("revoked");
    }
    expect(await listModerators()).toHaveLength(1);
    expect(await revokeModerator("first.mod@example.com")).toBe("last");
    expect(await isModerator("first.mod@example.com")).toBe(true);
  });
});
