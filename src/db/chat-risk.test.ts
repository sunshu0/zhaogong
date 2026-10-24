import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  chatRiskMessages,
  closeChatRisk,
  listChatRiskItems,
  recordChatRisk,
  resetChatRiskCleanupForTests,
} from "@/db/chat-risk";
import { addSharedMessage, openSharedConversation } from "@/db/conversations";
import { deleteAccount } from "@/db/account-data";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { createEmployer, ensureAccount } from "@/lib/data";
import type { ChatRiskRule } from "@/lib/chat-risk";

const start = new Date("2026-10-24T01:00:00.000Z");
const at = (hours: number) => new Date(start.getTime() + hours * 3_600_000);

/** A shop and a chat with one job seeker; `say` sends the shop's message at `hours` and records it as the server does. */
async function shopChat(name: string, seeker = `${name}.seeker@example.com`) {
  const shop = await createEmployer({ name, regionId: "akl-cbd" });
  await ensureAccount(seeker);
  const row = await openSharedConversation({
    seekerEmail: seeker,
    employerId: shop.id,
    jobId: "j1",
    startedBy: "seeker",
    now: start,
  });
  const say = async (text: string, hours: number, rules: ChatRiskRule[] = ["fee"]) => {
    await addSharedMessage(row.id, "employer", text, "王经理", at(hours));
    await recordChatRisk(
      { employerId: shop.id, conversationId: row.id, sentAt: at(hours).toISOString(), rules },
      at(hours),
    );
  };
  return { shop, row, seeker, say };
}

const itemOf = async (employerId: string) => (await listChatRiskItems()).find((i) => i.employerId === employerId);

describe("聊天风险 records (#384, ADR 0039)", () => {
  it("opens an item at the third message within seven days, then only adds to it", async () => {
    const { shop, say } = await shopChat("风险一号店");
    await say("先交押金", 0);
    await say("押金 200", 1);
    expect(await itemOf(shop.id)).toBeUndefined();
    await say("在家刷单", 2, ["task_scam"]);
    expect(await itemOf(shop.id)).toMatchObject({
      employerName: "风险一号店",
      rules: ["fee", "task_scam"],
      count: 3,
      lastAt: at(2).toISOString(),
      openedAt: at(2).toISOString(),
    });
    await say("交担保费", 3, ["visa_selling"]);
    const [flag] = await (
      await database()
    )
      .select()
      .from(t.chatRiskFlags)
      .where(eq(t.chatRiskFlags.employerId, shop.id));
    expect(flag.openedAt).toBe(at(2).toISOString()); // not opened again
    expect(await itemOf(shop.id)).toMatchObject({ rules: ["fee", "visa_selling", "task_scam"], count: 4 });
  });

  it("does not open for messages spread over more than seven days", async () => {
    const { shop, say } = await shopChat("风险二号店");
    await say("押金", 0);
    await say("押金", 24 * 4);
    await say("押金", 24 * 8);
    expect(await itemOf(shop.id)).toBeUndefined();
  });

  it("hands a moderator the messages, newest first, and after closing counts only new ones", async () => {
    const { shop, row, say } = await shopChat("风险三号店");
    await say("先交押金 1", 0);
    await say("先交押金 2", 1);
    await say("先交押金 3", 2);
    const messages = await chatRiskMessages(shop.id);
    expect(messages.map((m) => [m.text, m.byName, m.conversationId, m.rules])).toEqual([
      ["先交押金 3", "王经理", row.id, ["fee"]],
      ["先交押金 2", "王经理", row.id, ["fee"]],
      ["先交押金 1", "王经理", row.id, ["fee"]],
    ]);

    expect(await closeChatRisk(shop.id, at(3))).toEqual({ rules: ["fee"], count: 3 });
    expect(await closeChatRisk(shop.id, at(3))).toBeUndefined();
    expect(await itemOf(shop.id)).toBeUndefined();
    expect(await chatRiskMessages(shop.id)).toEqual([]);

    // Two old ones are still within seven days, but they were looked at: three new ones are needed.
    await say("押金 4", 4);
    await say("押金 5", 5);
    expect(await itemOf(shop.id)).toBeUndefined();
    await say("押金 6", 6);
    expect(await itemOf(shop.id)).toMatchObject({ count: 3 });
    expect((await chatRiskMessages(shop.id)).map((m) => m.text)).toEqual(["押金 6", "押金 5", "押金 4"]);
  });

  it("records nothing for a message that is not there", async () => {
    const { shop, row } = await shopChat("风险四号店");
    await recordChatRisk({ employerId: shop.id, conversationId: row.id, sentAt: at(9).toISOString(), rules: ["fee"] });
    const hits = await (await database()).select().from(t.chatRiskHits).where(eq(t.chatRiskHits.employerId, shop.id));
    expect(hits).toEqual([]);
  });

  it("deletes records older than 90 days with the first record of a day", async () => {
    const { shop, say } = await shopChat("风险五号店");
    await say("押金", 0);
    resetChatRiskCleanupForTests();
    await say("押金", 24 * 91);
    const hits = await (await database()).select().from(t.chatRiskHits).where(eq(t.chatRiskHits.employerId, shop.id));
    expect(hits.map((h) => h.at)).toEqual([at(24 * 91).toISOString()]);
  });

  it("goes with the job seeker's chat when they delete their account", async () => {
    const { shop, seeker, say } = await shopChat("风险六号店", "risk.six.seeker@example.com");
    await say("押金 1", 0);
    await say("押金 2", 1);
    await say("押金 3", 2);
    expect(await deleteAccount(seeker)).toBe("deleted");
    const hits = await (await database()).select().from(t.chatRiskHits).where(eq(t.chatRiskHits.employerId, shop.id));
    expect(hits).toEqual([]);
    expect(await itemOf(shop.id)).toBeUndefined(); // nothing left to look at
  });
});
