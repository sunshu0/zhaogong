import { describe, expect, it, vi } from "vitest";
import { databaseAuthStore } from "@/db/auth-store";
import { requestCode } from "@/lib/auth";

describe("where sign-in codes are kept by default", () => {
  it("in the database (#8), so a code still works after a server restart", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const sent = await requestCode("db.default@example.com");
    expect(sent.ok).toBe(true);
    // A fresh store over the same database, as after a restart, finds the code.
    expect(await databaseAuthStore().getCode("db.default@example.com")).toMatchObject({
      email: "db.default@example.com",
      attempts: 0,
    });
    vi.restoreAllMocks();
  });
});
