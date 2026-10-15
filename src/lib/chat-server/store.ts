// Where each identity's chat records and read notifications are kept on the server (#10). One interface: the
// database (src/db/chat-store.ts, #42) by default, the in-memory store for tests. Server only.
import type { ChatRecord } from "@/components/seeker/chat-store";
import { databaseChatStore } from "@/db/chat-store";

export interface ChatServerStore {
  /** The identity's own chat records (see chat-store.ts), keyed by identityScope(). */
  getChat(scope: string): Promise<ChatRecord | undefined>;
  putChat(scope: string, record: ChatRecord): Promise<void>;
  /** The ids of the notifications the identity has read. */
  getNotificationReads(scope: string): Promise<string[] | undefined>;
  putNotificationReads(scope: string, ids: string[]): Promise<void>;
  /** The ids of the newest changes applied (changeMyChat's ticket), so a change sent twice is applied once. */
  getAppliedChanges(scope: string): Promise<string[] | undefined>;
  putAppliedChanges(scope: string, ids: string[]): Promise<void>;
}

/** Kept in the server's memory: gone on restart. For tests. */
export function memoryChatStore(): ChatServerStore & { chats: Map<string, ChatRecord>; reads: Map<string, string[]> } {
  const chats = new Map<string, ChatRecord>();
  const reads = new Map<string, string[]>();
  const applied = new Map<string, string[]>();
  const copy = <T>(value: T): T => structuredClone(value);
  return {
    chats,
    reads,
    async getChat(scope) {
      const record = chats.get(scope);
      return record && copy(record);
    },
    async putChat(scope, record) {
      chats.set(scope, copy(record));
    },
    async getNotificationReads(scope) {
      const ids = reads.get(scope);
      return ids && [...ids];
    },
    async putNotificationReads(scope, ids) {
      reads.set(scope, [...ids]);
    },
    async getAppliedChanges(scope) {
      const ids = applied.get(scope);
      return ids && [...ids];
    },
    async putAppliedChanges(scope, ids) {
      applied.set(scope, [...ids]);
    },
  };
}

// One store per server process. Next bundles route handlers (/api/dev/chat-reply) and Server Functions separately,
// each with its own copy of this module, so the store hangs off globalThis instead of a module variable.
const holder = globalThis as typeof globalThis & { __zhaogongChatServerStore?: ChatServerStore };

export function chatServerStore(): ChatServerStore {
  return (holder.__zhaogongChatServerStore ??= databaseChatStore());
}

/** Tests: start from an empty store (or a given one). */
export function setChatServerStoreForTests(store: ChatServerStore = memoryChatStore()): ChatServerStore {
  holder.__zhaogongChatServerStore = store;
  return store;
}
