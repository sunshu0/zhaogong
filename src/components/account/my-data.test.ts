import { describe, expect, it } from "vitest";
import {
  confirmsEmail,
  forgetLocalData,
  localDataFor,
  myDataFile,
  myDataFileName,
  scopeEmail,
  type KeyedStorage,
} from "@/components/account/my-data";
import type { ServerAccountData } from "@/db/account-data";

function memoryStorage(entries: Record<string, unknown>): KeyedStorage & { data: Map<string, string> } {
  const data = new Map(
    Object.entries(entries).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)] as const),
  );
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const me = (role: "seeker" | "employer", business: string | null = null) =>
  JSON.stringify(["me@example.com", role, business]);
const other = JSON.stringify(["other@example.com", "seeker", null]);

/** A shared device: this account's data next to another account's and a guest's. */
function device() {
  return memoryStorage({
    "zhaogong:session": { email: "Me@Example.com", activeRole: "seeker", signedInAt: "2026-10-16T00:00:00Z" },
    "zhaogong:profiles-by-identity": {
      version: 2,
      identities: {
        [me("seeker")]: { name: "小王" },
        [me("employer", "e9")]: { about: "店" },
        [other]: { name: "别人" },
      },
    },
    "zhaogong:reports-sent:identities": { [me("seeker")]: [{ reportId: "r1" }], guest: [{ reportId: "r2" }] },
    "zhaogong:viewed-jobs:identities": { [other]: [{ jobId: "j1" }] },
    "zhaogong:chat-outbox": [
      { id: "c1", scope: me("seeker"), change: { type: "send" } },
      { id: "c2", scope: other, change: { type: "send" } },
    ],
    "zhaogong:notifications-by-identity": { version: 2, identities: { [me("seeker")]: ["n1"] } },
    "zhaogong:last-list-query": "region=akl",
    "not-ours": { [me("seeker")]: 1 },
  });
}

describe("scopeEmail", () => {
  it("reads the account of a scope, and of older bare-email keys", () => {
    expect(scopeEmail(me("employer", "e9"))).toBe("me@example.com");
    expect(scopeEmail("Me@Example.com")).toBe("me@example.com");
    expect(scopeEmail("guest")).toBeUndefined();
    expect(scopeEmail("[broken")).toBeUndefined();
  });
});

describe("localDataFor (#54)", () => {
  it("collects this account's part of every zhaogong key, both identities, nothing of others", () => {
    const mine = localDataFor(device(), " me@example.com ");
    expect(Object.keys(mine).sort()).toEqual([
      "zhaogong:chat-outbox",
      "zhaogong:notifications-by-identity",
      "zhaogong:profiles-by-identity",
      "zhaogong:reports-sent:identities",
      "zhaogong:session",
    ]);
    expect(mine["zhaogong:profiles-by-identity"]).toEqual({
      [me("seeker")]: { name: "小王" },
      [me("employer", "e9")]: { about: "店" },
    });
    expect(mine["zhaogong:chat-outbox"]).toEqual([{ id: "c1", scope: me("seeker"), change: { type: "send" } }]);
    expect(JSON.stringify(mine)).not.toContain("other@example.com");
    expect(JSON.stringify(mine)).not.toContain("r2"); // guest activity is not the account's
  });
});

describe("forgetLocalData (#54)", () => {
  it("removes this account's entries and keeps everyone else's, in the same shape", () => {
    const storage = device();
    forgetLocalData(storage, "me@example.com");
    const read = (key: string) => JSON.parse(storage.getItem(key) ?? "null");
    expect(storage.getItem("zhaogong:session")).toBeNull();
    expect(read("zhaogong:profiles-by-identity")).toEqual({ version: 2, identities: { [other]: { name: "别人" } } });
    expect(read("zhaogong:reports-sent:identities")).toEqual({ guest: [{ reportId: "r2" }] });
    expect(read("zhaogong:chat-outbox")).toEqual([{ id: "c2", scope: other, change: { type: "send" } }]);
    expect(storage.getItem("zhaogong:notifications-by-identity")).toBeNull(); // nothing left in it
    expect(read("zhaogong:viewed-jobs:identities")).toEqual({ [other]: [{ jobId: "j1" }] });
    expect(storage.getItem("zhaogong:last-list-query")).toBe("region=akl");
    expect(read("not-ours")).toEqual({ [me("seeker")]: 1 });
    expect(localDataFor(storage, "me@example.com")).toEqual({});
  });
});

describe("the export file", () => {
  it("says what it is and when it was made", () => {
    const now = new Date("2026-10-16T01:02:03Z");
    const server = { account: { email: "me@example.com" } } as ServerAccountData;
    expect(myDataFile(server, { k: 1 }, now)).toEqual({
      format: "zhaogong-my-data",
      version: 1,
      exportedAt: "2026-10-16T01:02:03.000Z",
      server,
      thisDevice: { k: 1 },
    });
    expect(myDataFileName(now)).toBe("zhaogong-my-data-2026-10-16.json");
  });
});

describe("confirmsEmail", () => {
  it("matches the signed-in email typed with any case or spaces, never an empty box", () => {
    expect(confirmsEmail(" ME@example.com ", "me@example.com")).toBe(true);
    expect(confirmsEmail("me@example.co", "me@example.com")).toBe(false);
    expect(confirmsEmail("  ", "")).toBe(false);
  });
});
