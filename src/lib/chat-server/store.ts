// Where each identity's chat records and read notifications are kept on the server (#10). One interface, so the
// database (line B) can take over from the in-memory store without touching the Server Functions. Server only.
import type { ChatRecord } from "@/components/seeker/chat-store";

export interface ChatServerStore {
  /** The identity's own chat records (see chat-store.ts), keyed by identityScope(). */
  getChat(scope: string): Promise<ChatRecord | undefined>;
  putChat(scope: string, record: ChatRecord): Promise<void>;
  /** The ids of the notifications the identity has read. */
  getNotificationReads(scope: string): Promise<string[] | undefined>;
  putNotificationReads(scope: string, ids: string[]): Promise<void>;
}

/** Kept in the server's memory, like the rest of the demo data until the database arrives. */
export function memoryChatStore(): ChatServerStore & { chats: Map<string, ChatRecord>; reads: Map<string, string[]> } {
  const chats = new Map<string, ChatRecord>();
  const reads = new Map<string, string[]>();
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
  };
}

let current: ChatServerStore = memoryChatStore();

export function chatServerStore(): ChatServerStore {
  return current;
}

/** Tests: start from an empty store (or a given one). */
export function setChatServerStoreForTests(store: ChatServerStore = memoryChatStore()): ChatServerStore {
  current = store;
  return store;
}
