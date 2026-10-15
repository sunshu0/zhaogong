import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { databaseChatStore } from "@/db/chat-store";
import { resetDatabaseForTests } from "@/db/ready";
import { ensureAccount } from "@/lib/data";
import { EMPTY_CHAT, addSentMessage } from "@/components/seeker/chat-store";

const scopeOf = (email: string, role: "seeker" | "employer" = "seeker", employerId: string | null = null) =>
  JSON.stringify([email, role, employerId]);
const sent = (text: string) => addSentMessage(EMPTY_CHAT, "c1", text, "2026-10-16T01:00:00.000Z");

describe("chat records in the database (#42)", () => {
  const store = databaseChatStore();

  it("has nothing for an identity that never wrote", async () => {
    const scope = scopeOf("nobody.yet@example.com");
    expect(await store.getChat(scope)).toBeUndefined();
    expect(await store.getNotificationReads(scope)).toBeUndefined();
    expect(await store.getAppliedChanges(scope)).toBeUndefined();
  });

  it("keeps the records, the read notifications and the applied tickets of one identity apart", async () => {
    await ensureAccount("li@example.com");
    const scope = scopeOf("li@example.com");
    await store.putNotificationReads(scope, ["n1", "n2"]); // before any chat: the row starts without a record
    await store.putChat(scope, sent("你好"));
    await store.putAppliedChanges(scope, ["t1"]);
    await store.putChat(scope, sent("还在招吗")); // replaces, and leaves the other two alone
    expect(await store.getChat(scope)).toEqual(sent("还在招吗"));
    expect(await store.getNotificationReads(scope)).toEqual(["n1", "n2"]);
    expect(await store.getAppliedChanges(scope)).toEqual(["t1"]);
  });

  it("keeps two identities of one account apart", async () => {
    await ensureAccount("two.roles@example.com");
    const seeker = scopeOf("two.roles@example.com");
    const employer = scopeOf("two.roles@example.com", "employer", "e1");
    await store.putChat(seeker, sent("求职的我"));
    await store.putChat(employer, sent("招人的我"));
    await store.putNotificationReads(employer, ["n9"]);
    expect(await store.getChat(seeker)).toEqual(sent("求职的我"));
    expect(await store.getChat(employer)).toEqual(sent("招人的我"));
    expect(await store.getNotificationReads(seeker)).toBeUndefined();
  });

  it("returns copies: changing what it gave back changes nothing stored", async () => {
    await ensureAccount("copies@example.com");
    const scope = scopeOf("copies@example.com");
    await store.putNotificationReads(scope, ["n1"]);
    (await store.getNotificationReads(scope))!.push("n2");
    expect(await store.getNotificationReads(scope)).toEqual(["n1"]);
  });

  it("drops a stored record that no longer parses, instead of handing it to the page", async () => {
    await ensureAccount("broken@example.com");
    const scope = scopeOf("broken@example.com");
    await store.putChat(scope, "not a record" as never);
    expect(await store.getChat(scope)).toBeUndefined();
  });
});

describe("kept across a restart (#42)", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "zhaogong-chat-"));
  const saved = process.env.DATABASE_URL;
  const restart = () => resetDatabaseForTests();

  beforeAll(() => {
    process.env.DATABASE_URL = `file:${path.join(dir, "zhaogong.db")}`;
    restart();
  });
  afterAll(() => {
    restart();
    process.env.DATABASE_URL = saved;
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {}
  });

  it("reads back what an earlier server wrote, through a new store", async () => {
    await ensureAccount("restart@example.com");
    const scope = scopeOf("restart@example.com");
    const before = databaseChatStore();
    await before.putChat(scope, sent("重启前写的"));
    await before.putNotificationReads(scope, ["n1"]);
    await before.putAppliedChanges(scope, ["t1", "t2"]);

    restart();
    const after = databaseChatStore();
    expect(await after.getChat(scope)).toEqual(sent("重启前写的"));
    expect(await after.getNotificationReads(scope)).toEqual(["n1"]);
    expect(await after.getAppliedChanges(scope)).toEqual(["t1", "t2"]);
  });
});
