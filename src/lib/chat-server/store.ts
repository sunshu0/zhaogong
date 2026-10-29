// Where each identity's chat records and read notifications are kept on the server (#10). One interface: the
// database (src/db/chat-store.ts, #42) by default, the in-memory store for tests. Server only.
import type { ChatRecord } from "@/components/seeker/chat-store";
import { databaseChatStore } from "@/db/chat-store";

export interface ChatServerStore {
  /** The identity's own chat records (see chat-store.ts), keyed by identityScope(). */
  getChat(scope: string): Promise<ChatRecord | undefined>;
  putChat(scope: string, record: ChatRecord): Promise<void>;
  /**
   * The record with the version a conditional write checks: null while there is no row yet. A change read, decided
   * and written with putChatIf is lost to nobody (ADR 0031): two teammates pinning at once both keep their pin (C7).
   */
  getVersionedChat(scope: string): Promise<{ record: ChatRecord | undefined; version: string | null }>;
  /** Writes the record only if it is still at `version` (no row yet for null); whether it did. */
  putChatIf(scope: string, record: ChatRecord, version: string | null): Promise<boolean>;
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
  const versions = new Map<string, number>();
  const copy = <T>(value: T): T => structuredClone(value);
  const put = (scope: string, record: ChatRecord) => {
    chats.set(scope, copy(record));
    versions.set(scope, (versions.get(scope) ?? 0) + 1);
  };
  return {
    chats,
    reads,
    async getChat(scope) {
      const record = chats.get(scope);
      return record && copy(record);
    },
    async putChat(scope, record) {
      put(scope, record);
    },
    async getVersionedChat(scope) {
      const record = chats.get(scope);
      const version = versions.get(scope);
      return { record: record && copy(record), version: record ? String(version ?? 0) : null };
    },
    async putChatIf(scope, record, version) {
      const now = chats.has(scope) ? String(versions.get(scope) ?? 0) : null;
      if (now !== version) return false;
      put(scope, record);
      return true;
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
