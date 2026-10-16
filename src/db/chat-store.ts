// Each identity's chat records in the database (#42): the database version of #10's ChatServerStore
// (src/lib/chat-server/store.ts), one row per identity in chat_records. A business's shared record (team:<id>, #87)
// is a row in team_chats instead. Server only.
import { eq } from "drizzle-orm";
import { database } from "@/db/ready";
import { chatRecords, teamChats } from "@/db/schema";
import type { ChatServerStore } from "@/lib/chat-server/store";
import { parseChatRecord } from "@/components/seeker/chat-store";

type Column = "record" | "notificationReads" | "appliedChanges";

/** The account in an identityScope ([email, role, employerId]); the row needs it for its foreign key. */
function emailOf(scope: string): string {
  const parsed: unknown = JSON.parse(scope);
  if (!Array.isArray(parsed) || typeof parsed[0] !== "string") throw new Error(`Not an identity scope: ${scope}`);
  return parsed[0];
}

const ids = (value: unknown): string[] | undefined =>
  Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : undefined;

const TEAM_PREFIX = "team:";

async function readTeamChat(employerId: string) {
  const db = await database();
  const [row] = await db.select().from(teamChats).where(eq(teamChats.employerId, employerId));
  return row ? parseChatRecord(row.record) : undefined;
}

async function writeTeamChat(employerId: string, record: unknown) {
  const db = await database();
  const updatedAt = new Date().toISOString();
  await db
    .insert(teamChats)
    .values({ employerId, record, updatedAt })
    .onConflictDoUpdate({ target: teamChats.employerId, set: { record, updatedAt } });
}

export function databaseChatStore(): ChatServerStore {
  async function read(scope: string) {
    const db = await database();
    const [row] = await db.select().from(chatRecords).where(eq(chatRecords.scope, scope));
    return row;
  }

  /** Writes one column of the identity's row, making the row the first time. */
  async function write(scope: string, column: Column, value: unknown) {
    const db = await database();
    const updatedAt = new Date().toISOString();
    await db
      .insert(chatRecords)
      .values({ scope, email: emailOf(scope), [column]: value, updatedAt })
      .onConflictDoUpdate({ target: chatRecords.scope, set: { [column]: value, updatedAt } });
  }

  return {
    async getChat(scope) {
      if (scope.startsWith(TEAM_PREFIX)) return readTeamChat(scope.slice(TEAM_PREFIX.length));
      const row = await read(scope);
      return row?.record == null ? undefined : parseChatRecord(row.record);
    },
    putChat: (scope, record) =>
      scope.startsWith(TEAM_PREFIX)
        ? writeTeamChat(scope.slice(TEAM_PREFIX.length), record)
        : write(scope, "record", record),
    async getNotificationReads(scope) {
      return ids((await read(scope))?.notificationReads);
    },
    putNotificationReads: (scope, list) => write(scope, "notificationReads", [...list]),
    async getAppliedChanges(scope) {
      return ids((await read(scope))?.appliedChanges);
    },
    putAppliedChanges: (scope, list) => write(scope, "appliedChanges", [...list]),
  };
}
