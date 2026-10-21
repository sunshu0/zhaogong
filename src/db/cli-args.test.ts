import { describe, expect, it } from "vitest";
import { parseDatabaseArguments } from "@/db/cli-args";

describe("database command arguments", () => {
  it("keeps existing libSQL maintenance commands", () => {
    expect(parseDatabaseArguments(["seed"])).toEqual({
      command: "seed",
      args: [],
      localD1: false,
      persistTo: ".wrangler/state",
    });
    expect(parseDatabaseArguments(["admin:grant", "person@example.com"]).args).toEqual(["person@example.com"]);
  });

  it("accepts an isolated local D1 directory without splitting spaces", () => {
    expect(
      parseDatabaseArguments([
        "admin:revoke",
        "--persist-to",
        "D:/isolated data/d1",
        "person@example.com",
        "--d1-local",
      ]),
    ).toMatchObject({ args: ["person@example.com"], localD1: true, persistTo: "D:/isolated data/d1" });
  });

  it("preserves import dry runs and selected company ids", () => {
    expect(parseDatabaseArguments(["import:external", "company-a", "--dry-run", "company-b"]).args).toEqual([
      "--dry-run",
      "company-a",
      "company-b",
    ]);
  });

  it.each([
    [],
    ["db:seed"],
    ["seed", "--d1-lcoal"],
    ["migrate", "--d1-remote"],
    ["seed", "--d1-local", "--d1-remote"],
    ["seed", "--persist-to", "somewhere"],
    ["seed", "--d1-local", "--persist-to"],
    ["seed", "--d1-local", "--persist-to", "--dry-run"],
    ["seed", "--d1-local", "--persist-to="],
    ["seed", "--d1-local", "--persist-to", "   "],
    ["seed", "--d1-local", "--d1-local"],
    ["seed", "--d1-local", "--persist-to=a", "--persist-to=b"],
    ["seed", "--dry-run"],
    ["seed", "unexpected"],
    ["admin:grant"],
    ["admin:grant", "one@example.com", "two@example.com"],
  ])("rejects invalid arguments before database setup: %j", (...argv: string[]) => {
    expect(() => parseDatabaseArguments(argv)).toThrow();
  });
});
