// 导出我的数据 and 删除账号 in the browser (#54). Some of a person's data lives only on their device (profiles, reports
// sent, jobs viewed, chats not yet sent), under "zhaogong:" keys, each a map from an identity scope
// (identity-scope.ts) to that identity's entry, or a list of items that carry their scope. These helpers find the
// account's part of every such key, for the export, and remove it when the account is deleted. Other accounts'
// entries on a shared device stay. Pure functions over a Storage, so they can be unit-tested.
import { normalizeEmail } from "@/components/seeker/session";
import type { ServerAccountData } from "@/db/account-data";

export type KeyedStorage = Pick<Storage, "length" | "key" | "getItem" | "setItem" | "removeItem">;

const PREFIX = "zhaogong:";

/** The account an identity scope belongs to: `[email, role, business]`, or a bare email in older data. */
export function scopeEmail(scope: string): string | undefined {
  if (!scope.startsWith("[")) return scope.includes("@") ? normalizeEmail(scope) : undefined;
  try {
    const identity: unknown = JSON.parse(scope);
    return Array.isArray(identity) && typeof identity[0] === "string" ? normalizeEmail(identity[0]) : undefined;
  } catch {
    return undefined;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

type Split = { mine: unknown; rest: unknown } | undefined;

/** One stored value split into the account's part and everyone else's; undefined when nothing in it is the account's. */
function split(value: unknown, email: string): Split {
  const owned = (scope: unknown) => typeof scope === "string" && scopeEmail(scope) === email;
  if (Array.isArray(value)) {
    const mine = value.filter((item) => isObject(item) && owned(item.scope));
    return mine.length ? { mine, rest: value.filter((item) => !mine.includes(item)) } : undefined;
  }
  if (!isObject(value)) return undefined;
  if (typeof value.email === "string") {
    // The browser's copy of the session.
    return normalizeEmail(value.email) === email ? { mine: value, rest: undefined } : undefined;
  }
  const versioned = "version" in value && isObject(value.identities);
  const map = versioned ? (value.identities as Record<string, unknown>) : value;
  const mine = Object.fromEntries(Object.entries(map).filter(([scope]) => owned(scope)));
  if (!Object.keys(mine).length) return undefined;
  const others = Object.fromEntries(Object.entries(map).filter(([scope]) => !owned(scope)));
  return { mine, rest: versioned ? { ...value, identities: others } : others };
}

function* ownedEntries(storage: KeyedStorage, email: string) {
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
    (key): key is string => !!key?.startsWith(PREFIX),
  );
  for (const key of keys) {
    let value: unknown;
    try {
      value = JSON.parse(storage.getItem(key) ?? "null");
    } catch {
      continue;
    }
    const parts = split(value, normalizeEmail(email));
    if (parts) yield { key, ...parts };
  }
}

/** The account's part of every key on this device, by key. */
export function localDataFor(storage: KeyedStorage, email: string): Record<string, unknown> {
  return Object.fromEntries([...ownedEntries(storage, email)].map(({ key, mine }) => [key, mine]));
}

/** Removes the account's part of every key on this device, the session copy included. */
export function forgetLocalData(storage: KeyedStorage, email: string): void {
  for (const { key, rest } of [...ownedEntries(storage, email)]) {
    const empty =
      rest === undefined ||
      (Array.isArray(rest) && !rest.length) ||
      (isObject(rest) && !Object.keys(isObject(rest.identities) ? rest.identities : rest).length);
    if (empty) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(rest));
  }
}

export interface MyDataFile {
  format: "zhaogong-my-data";
  version: 1;
  exportedAt: string;
  /** What the server keeps about the account. */
  server: ServerAccountData;
  /** What this browser keeps for the account, by storage key; other devices keep their own. */
  thisDevice: Record<string, unknown>;
}

export function myDataFile(server: ServerAccountData, thisDevice: Record<string, unknown>, now: Date): MyDataFile {
  return { format: "zhaogong-my-data", version: 1, exportedAt: now.toISOString(), server, thisDevice };
}

export function myDataFileName(now: Date): string {
  return `zhaogong-my-data-${now.toISOString().slice(0, 10)}.json`;
}

/** The typed confirmation matches the signed-in email (case and spaces aside). */
export function confirmsEmail(typed: string, email: string): boolean {
  return typed.trim() !== "" && normalizeEmail(typed) === normalizeEmail(email);
}
