// Each identity's chat records in the database (#42): the database version of #10's ChatServerStore
// (src/lib/chat-server/store.ts), one row per identity in chat_records. A business's shared record (team:<id>, #87)
// is a row in team_chats instead. Server only.
import { and, eq } from "drizzle-orm";
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

/**
 * A row's next updated_at: now, but always after the one it had, so a conditional write that read the old one can
 * tell (two writes in one millisecond would otherwise look alike).
 */
function nextVersion(previous: string | null): string {
  const now = new Date();
  if (previous && now.toISOString() <= previous) return new Date(Date.parse(previous) + 1).toISOString();
  return now.toISOString();
}

/** The business's shared record written only if its row is still at `version` (ADR 0031). */
async function writeTeamChatIf(employerId: string, record: unknown, version: string | null): Promise<boolean> {
  const db = await database();
  const updatedAt = nextVersion(version);
  const written =
    version === null
      ? await db.insert(teamChats).values({ employerId, record, updatedAt }).onConflictDoNothing().returning()
      : await db
          .update(teamChats)
          .set({ record, updatedAt })
          .where(and(eq(teamChats.employerId, employerId), eq(teamChats.updatedAt, version)))
          .returning();
  return written.length > 0;
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
    async getVersionedChat(scope) {
      if (scope.startsWith(TEAM_PREFIX)) {
        const db = await database();
        const [row] = await db
          .select()
          .from(teamChats)
          .where(eq(teamChats.employerId, scope.slice(TEAM_PREFIX.length)));
        return { record: row ? parseChatRecord(row.record) : undefined, version: row?.updatedAt ?? null };
      }
      const row = await read(scope);
      return {
        record: row?.record == null ? undefined : parseChatRecord(row.record),
        version: row?.updatedAt ?? null,
      };
    },
    async putChatIf(scope, record, version) {
      if (scope.startsWith(TEAM_PREFIX)) return writeTeamChatIf(scope.slice(TEAM_PREFIX.length), record, version);
      const db = await database();
      const updatedAt = nextVersion(version);
      // The row also holds notification reads and applied tickets; writing those moves its version on too, and a
      // change that read before them is decided again: nothing is lost, at worst one more read.
      const written =
        version === null
          ? await db
              .insert(chatRecords)
              .values({ scope, email: emailOf(scope), record, updatedAt })
              .onConflictDoNothing()
              .returning()
          : await db
              .update(chatRecords)
              .set({ record, updatedAt })
              .where(and(eq(chatRecords.scope, scope), eq(chatRecords.updatedAt, version)))
              .returning();
      return written.length > 0;
    },
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
