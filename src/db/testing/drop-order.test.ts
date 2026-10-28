import { describe, expect, it } from "vitest";
import { childFirstTables, sqlIdentifier } from "./drop-order";

describe("D1 reset table order", () => {
  it("drops the full push → session → account cascade chain before any referenced parent", () => {
    // sqlite_master lists these parents before the later migration's push tables.
    const tables = Object.freeze([
      Object.freeze({ name: "accounts", parents: Object.freeze([]) }),
      Object.freeze({ name: "sessions", parents: Object.freeze(["accounts"]) }),
      Object.freeze({ name: "push_subscriptions", parents: Object.freeze(["sessions", "accounts", "accounts"]) }),
      Object.freeze({ name: "push_setups", parents: Object.freeze(["sessions"]) }),
    ]);
    const original = JSON.stringify(tables);
    const order = childFirstTables(tables);
    expect(new Set(order)).toEqual(new Set(tables.map((table) => table.name)));
    expect(order.indexOf("push_subscriptions")).toBeLessThan(order.indexOf("sessions"));
    expect(order.indexOf("push_setups")).toBeLessThan(order.indexOf("sessions"));
    expect(order.indexOf("sessions")).toBeLessThan(order.indexOf("accounts"));
    expect(JSON.stringify(tables)).toBe(original);
  });

  it("handles an empty database, self-references, excluded parents and SQLite's case-insensitive names", () => {
    expect(childFirstTables([])).toEqual([]);
    expect(childFirstTables([{ name: "staff", parents: ["STAFF", "retained_external_table"] }])).toEqual(["staff"]);
    expect(
      childFirstTables([
        { name: "Parent", parents: [] },
        { name: "Child", parents: ["PARENT", "parent"] },
      ]),
    ).toEqual(["Child", "Parent"]);
  });

  it("rejects cross-table cycles and duplicate names instead of returning a partial destructive plan", () => {
    expect(() =>
      childFirstTables([
        { name: "unrelated", parents: [] },
        { name: "a", parents: ["b"] },
        { name: "b", parents: ["c"] },
        { name: "c", parents: ["a"] },
      ]),
    ).toThrow("foreign-key cycle");
    expect(() =>
      childFirstTables([
        { name: "same", parents: [] },
        { name: "SAME", parents: [] },
      ]),
    ).toThrow("duplicate table name");
  });

  it("quotes unusual database identifiers without turning their contents into SQL", () => {
    expect(sqlIdentifier('table"; DROP TABLE accounts; --')).toBe('"table""; DROP TABLE accounts; --"');
  });
});
