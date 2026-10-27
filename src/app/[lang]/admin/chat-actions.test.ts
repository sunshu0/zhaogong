import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { banEmployer, createEmployer, ensureAccount, openEmployerIdentity, tempBanEmployer } from "@/lib/data";
import { grantModerator } from "@/db/moderators";
import { database } from "@/db/ready";
import * as t from "@/db/schema";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar, headers: async () => new Headers() }));

const { getModeratorChats, getModeratorChatThread, sendModeratorChatMessage, startModeratorChat } =
  await import("@/app/[lang]/admin/chat-actions");
const { myModeratorChat, readMyModeratorChat, sendToModerators } =
  await import("@/app/[lang]/messages/moderator-chat-actions");

const MODERATOR = "chat.moderator@example.com";
const OTHER_MODERATOR = "chat.moderator2@example.com";

async function signIn(email: string, role: "seeker" | "employer" = "seeker") {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, role, jar);
}

/** A business with two people in its team: its first (admin) and a member. */
async function shopWithTeam(name: string) {
  const shop = await createEmployer({ name, regionId: "akl-cbd" });
  const boss = `${shop.id}.boss@example.com`;
  const member = `${shop.id}.member@example.com`;
  await openEmployerIdentity(boss, shop.id);
  await ensureAccount(member);
  const db = await database();
  await db.update(t.accounts).set({ teamName: "王经理" }).where(eq(t.accounts.email, boss));
  await db
    .update(t.accounts)
    .set({ employerId: shop.id, teamRole: "member", teamName: "小李" })
    .where(eq(t.accounts.email, member));
  return { shop, boss, member };
}

beforeAll(async () => {
  vi.stubEnv("ADMIN_ENABLED", "1");
  setAuthStoreForTests();
  for (const email of [MODERATOR, OTHER_MODERATOR]) {
    await ensureAccount(email);
    await grantModerator(email, null);
  }
});

beforeEach(() => cookies.clear());

describe("审核员和雇主聊天 (#407, ADR 0046)", () => {
  it("only a moderator opens a conversation; the business cannot start one", async () => {
    const { shop, boss } = await shopWithTeam("开头店");
    await signIn(boss, "employer");
    expect(await startModeratorChat(shop.id, "report")).toEqual({ ok: false, error_zh: "只有审核员能使用审核后台。" });
    expect(await getModeratorChats()).toMatchObject({ refused: "not_moderator" });
    expect(await myModeratorChat()).toBeNull();
    expect(await sendToModerators("我想申诉")).toEqual({ ok: false, error: "这段对话已经没有了。" });

    await signIn(MODERATOR);
    expect(await startModeratorChat("e-none", "report")).toEqual({ ok: false, error_zh: "找不到这家企业。" });
    expect(await startModeratorChat(shop.id, "verification")).toEqual({ ok: true, employerId: shop.id });
    // A second start keeps the one conversation.
    expect(await startModeratorChat(shop.id, "report")).toEqual({ ok: true, employerId: shop.id });
    const [row] = await (
      await database()
    )
      .select()
      .from(t.moderatorChats)
      .where(eq(t.moderatorChats.employerId, shop.id));
    expect(row).toMatchObject({ openedBy: MODERATOR, openedFrom: "verification" });
  });

  it("everyone in the team reads and replies; the business sees 找工审核员, the moderators see who wrote", async () => {
    const { shop, boss, member } = await shopWithTeam("团队店");
    await signIn(MODERATOR);
    await startModeratorChat(shop.id, "report");
    expect(await sendModeratorChatMessage(shop.id, "  请说明押金的事 ")).toEqual({ ok: true, employerId: shop.id });
    expect(await sendModeratorChatMessage(shop.id, " ")).toEqual({ ok: false, error_zh: "请先写消息。" });

    await signIn(member, "employer");
    const seen = await myModeratorChat();
    expect(seen?.lines).toEqual([
      { id: expect.any(Number), mine: false, text: "请说明押金的事", sentAt: expect.any(String) },
    ]);
    expect(seen?.unread).toBe(1);
    expect(JSON.stringify(seen)).not.toContain(MODERATOR);
    await readMyModeratorChat();
    expect((await myModeratorChat())?.unread).toBe(0);
    const replied = await sendToModerators("没有收押金");
    expect(replied.ok && replied.view.lines.at(-1)).toMatchObject({ mine: true, text: "没有收押金", by: "小李" });

    await signIn(boss, "employer");
    expect((await myModeratorChat())?.lines.map((l) => [l.mine, l.text])).toEqual([
      [false, "请说明押金的事"],
      [true, "没有收押金"],
    ]);
    expect(await sendToModerators("我是老板，确认没有")).toMatchObject({ ok: true });

    // Another moderator: the list says what waits, the conversation who wrote what.
    await signIn(OTHER_MODERATOR);
    const list = await getModeratorChats();
    expect("chats" in list && list.chats.find((c) => c.employerId === shop.id)).toMatchObject({
      employerName: "团队店",
      unread: 2,
      last: { from: "employer", text: "我是老板，确认没有" },
    });
    const thread = await getModeratorChatThread(shop.id);
    expect("view" in thread && thread.view?.lines.map((l) => [l.mine, l.by])).toEqual([
      [true, MODERATOR],
      [false, "小李"],
      [false, "王经理"],
    ]);
    // Reading it marked it read for the moderators.
    const after = await getModeratorChats();
    expect("chats" in after && after.chats.find((c) => c.employerId === shop.id)?.unread).toBe(0);
  });

  it("a banned business still reads and replies, whichever identity its people are in", async () => {
    const temp = await shopWithTeam("暂封店");
    const gone = await shopWithTeam("永封店");
    await signIn(MODERATOR);
    for (const shop of [temp.shop, gone.shop]) {
      await startModeratorChat(shop.id, "temp_ban");
      await sendModeratorChatMessage(shop.id, "你的企业被限制了，有话可以在这里说");
    }
    await tempBanEmployer(temp.shop.id, 7, "要求交押金");
    await banEmployer(gone.shop.id);

    for (const { member } of [temp, gone]) {
      // Kept out of the employer identity, the session is a job seeker's.
      await signIn(member, "employer");
      expect((await myModeratorChat())?.lines).toHaveLength(1);
      expect(await sendToModerators("我想申诉")).toMatchObject({ ok: true });
    }
  });

  it("an identity that is not the business's sees nothing: a job seeker, or the team in its job seeker identity", async () => {
    const { shop, boss } = await shopWithTeam("身份店");
    await signIn(MODERATOR);
    await startModeratorChat(shop.id, "report");
    await signIn("just.a.seeker@example.com");
    expect(await myModeratorChat()).toBeNull();
    await signIn(boss, "seeker");
    expect(await myModeratorChat()).toBeNull();
  });
});
