"use client";

// What someone has started writing in each conversation (#281), so switching to another conversation or reloading
// the page does not throw it away. Kept in sessionStorage, per identity and conversation: it goes when the tab is
// closed, so a shared computer keeps nobody's half-written message; sending empties it.
import { useSyncExternalStore } from "react";
import { MESSAGE_MAX } from "@/components/seeker/chat-store";
import type { StorageLike } from "@/components/seeker/session";

export const DRAFTS_KEY = "zhaogong:chat-drafts";
/** More conversations than anyone writes in at once; the oldest drafts go first past it. */
const DRAFTS_MAX = 50;

const draftKey = (scope: string, conversationId: string) => `${scope}|${conversationId}`;

function readAll(storage: StorageLike): Record<string, string> {
  try {
    const value: unknown = JSON.parse(storage.getItem(DRAFTS_KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

/** The draft of one conversation for one identity; "" when there is none. */
export function readDraft(storage: StorageLike, scope: string, conversationId: string): string {
  return readAll(storage)[draftKey(scope, conversationId)] ?? "";
}

/** Keeps the draft (at most MESSAGE_MAX characters, as the box allows); an empty one is removed. */
export function writeDraft(storage: StorageLike, scope: string, conversationId: string, text: string): void {
  const key = draftKey(scope, conversationId);
  // Delete first, so a changed draft moves to the end and the oldest are the ones dropped past DRAFTS_MAX.
  const kept = readAll(storage);
  delete kept[key];
  if (text) kept[key] = text.slice(0, MESSAGE_MAX);
  const entries = Object.entries(kept).slice(-DRAFTS_MAX);
  if (entries.length) storage.setItem(DRAFTS_KEY, JSON.stringify(Object.fromEntries(entries)));
  else storage.removeItem(DRAFTS_KEY);
}

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** sessionStorage, or null where the browser refuses it (some private windows): drafts then live only in the box. */
function tabStorage(): StorageLike | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** The open conversation's draft and how to change it; "" during server rendering and with no conversation open. */
export function useChatDraft(scope: string, conversationId: string | null): [string, (text: string) => void] {
  const draft = useSyncExternalStore(
    subscribe,
    () => {
      const storage = tabStorage();
      return storage && conversationId ? readDraft(storage, scope, conversationId) : "";
    },
    () => "",
  );
  const setDraft = (text: string) => {
    const storage = tabStorage();
    if (!storage || !conversationId) return;
    writeDraft(storage, scope, conversationId, text);
    for (const listener of listeners) listener();
  };
  return [draft, setDraft];
}
