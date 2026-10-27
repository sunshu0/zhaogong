import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  addModeratorChatMessage,
  getModeratorChat,
  listModeratorChats,
  moderatorChatMessages,
  openModeratorChat,
} from "@/db/moderator-chats";
import { deleteAccount, exportAccountData } from "@/db/account-data";
import { grantModerator } from "@/db/moderators";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { createEmployer, ensureAccount, openEmployerIdentity } from "@/lib/data";
import { DELETED_ACCOUNT } from "@/lib/deleted-account";

/** A business whose team is `people` (the first opens it), with a moderator's conversation in which each has written. */
async function talkingShop(name: string, people: string[], moderator: string) {
  const shop = await createEmployer({ name, regionId: "akl-cbd" });
  await openEmployerIdentity(people[0], shop.id);
  const db = await database();
  for (const member of people.slice(1)) {
    await ensureAccount(member);
    await db.update(t.accounts).set({ employerId: shop.id, teamRole: "member" }).where(eq(t.accounts.email, member));
  }
  await ensureAccount(moderator);
  await grantModerator(moderator, null);
  expect(await openModeratorChat(shop.id, moderator, "report")).toBe(true);
  expect(
    await addModeratorChatMessage({ employerId: shop.id, from: "moderator", senderEmail: moderator, text: "你好" }),
  ).toBe(true);
  for (const person of people)
    await addModeratorChatMessage({
      employerId: shop.id,
      from: "employer",
      senderEmail: person,
      text: `我是 ${person}`,
    });
  return shop;
}

describe("moderator_chats (#407, ADR 0046)", () => {
  it("takes messages only into a conversation that is open, and lists it with the last one", async () => {
    const shop = await createEmployer({ name: "列表店", regionId: "akl-cbd" });
    expect(
      await addModeratorChatMessage({
        employerId: shop.id,
        from: "employer",
        senderEmail: "x@example.com",
        text: "hi",
      }),
    ).toBe(false);
    expect(await openModeratorChat("e-none", "m@example.com", "report")).toBe(false);
    expect(await openModeratorChat(shop.id, "m@example.com", "temp_ban", new Date("2026-10-27T00:00:00.000Z"))).toBe(
      true,
    );
    expect(
      await addModeratorChatMessage({
        employerId: shop.id,
        from: "employer",
        senderEmail: "x@example.com",
        byName: "老王",
        text: "hi",
      }),
    ).toBe(true);
    expect(await moderatorChatMessages(shop.id)).toMatchObject([{ from: "employer", byName: "老王", text: "hi" }]);
    // Whoever sends has read what came before; the moderators have not read the business's message.
    expect((await getModeratorChat(shop.id))?.employerReadAt).toBeTruthy();
    expect((await listModeratorChats()).find((c) => c.employerId === shop.id)).toMatchObject({
      employerName: "列表店",
      unread: 1,
      last: { from: "employer", text: "hi" },
    });
  });

  it("a moderator's or a teammate's deleted account leaves the conversation without the email", async () => {
    const shop = await talkingShop(
      "留下店",
      ["stay.boss@example.com", "stay.member@example.com"],
      "gone.mod@example.com",
    );
    expect((await exportAccountData("stay.member@example.com"))?.moderatorChatMessages).toEqual([
      { employerId: shop.id, from: "employer", text: "我是 stay.member@example.com", sentAt: expect.any(String) },
    ]);
    expect(await deleteAccount("gone.mod@example.com")).toBe("deleted");
    expect(await deleteAccount("stay.member@example.com")).toBe("deleted");
    expect((await getModeratorChat(shop.id))?.openedBy).toBe(DELETED_ACCOUNT);
    expect((await moderatorChatMessages(shop.id)).map((m) => m.senderEmail)).toEqual([
      DELETED_ACCOUNT,
      "stay.boss@example.com",
      DELETED_ACCOUNT,
    ]);
  });

  it("goes with the business's other chats when its last teammate deletes the account", async () => {
    const shop = await talkingShop("最后店", ["last.boss@example.com"], "last.mod@example.com");
    expect(await deleteAccount("last.boss@example.com")).toBe("deleted");
    expect(await getModeratorChat(shop.id)).toBeUndefined();
    expect(await moderatorChatMessages(shop.id)).toEqual([]);
  });
});
