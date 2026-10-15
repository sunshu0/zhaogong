// Chat changes this browser has shown but the server has not confirmed yet (#10). Kept in localStorage, so a change
// is not lost when the page is left before its request goes out: the next page load sends it again. Each carries an
// id the server applies only once (changeMyChat's ticket), so sending it twice is safe.
import type { ChatChange } from "@/app/messages/actions";
import type { StorageLike } from "@/components/seeker/session";

export const OUTBOX_KEY = "zhaogong:chat-outbox";
/** More than anyone sends before hearing back; the oldest go first if a browser stays offline that long. */
const OUTBOX_MAX = 100;

export type OutboxItem = { id: string; scope: string; change: ChatChange };

/** The items, oldest first. The server checks each change itself; here only the shape is checked. */
export function readOutbox(storage: StorageLike): OutboxItem[] {
  try {
    const value: unknown = JSON.parse(storage.getItem(OUTBOX_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(
      (item): item is OutboxItem =>
        !!item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.scope === "string" &&
        !!item.change &&
        typeof item.change === "object" &&
        typeof item.change.type === "string",
    );
  } catch {
    return [];
  }
}

function writeOutbox(storage: StorageLike, items: OutboxItem[]) {
  if (items.length) storage.setItem(OUTBOX_KEY, JSON.stringify(items.slice(-OUTBOX_MAX)));
  else storage.removeItem(OUTBOX_KEY);
}

export function addToOutbox(storage: StorageLike, item: OutboxItem): void {
  writeOutbox(storage, [...readOutbox(storage).filter((x) => x.id !== item.id), item]);
}

export function removeFromOutbox(storage: StorageLike, id: string): void {
  writeOutbox(
    storage,
    readOutbox(storage).filter((x) => x.id !== id),
  );
}

/** What is still to send for one identity, oldest first. */
export function outboxFor(storage: StorageLike, scope: string): OutboxItem[] {
  return readOutbox(storage).filter((x) => x.scope === scope);
}
