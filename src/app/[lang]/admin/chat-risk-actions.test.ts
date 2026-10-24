import { beforeAll, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { createEmployer, ensureAccount, listModerationLog } from "@/lib/data";
import { addSharedMessage, openSharedConversation } from "@/db/conversations";
import { recordChatRisk } from "@/db/chat-risk";
import { grantModerator } from "@/db/moderators";
import { listViews } from "@/db/personal-info-views";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { closeChatRiskItem, getChatRiskMessages, getChatRiskQueue } =
  await import("@/app/[lang]/admin/chat-risk-actions");

const MODERATOR = "risk.moderator@example.com";

async function signIn(email: string) {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, "seeker", jar);
}

/** A business that sent three messages about a deposit to one job seeker, an hour apart. */
async function riskyShop() {
  const shop = await createEmployer({ name: "押金茶楼", regionId: "akl-cbd" });
  await ensureAccount("risk.actions.seeker@example.com");
  const row = await openSharedConversation({
    seekerEmail: "risk.actions.seeker@example.com",
    employerId: shop.id,
    jobId: "j1",
    startedBy: "seeker",
  });
  for (let i = 0; i < 3; i++) {
    const sent = new Date(Date.now() - (3 - i) * 3_600_000);
    await addSharedMessage(row.id, "employer", `先交押金 ${i + 1}`, "王经理", sent);
    await recordChatRisk(
      { employerId: shop.id, conversationId: row.id, sentAt: sent.toISOString(), rules: ["fee"] },
      sent,
    );
  }
  return { shop, row };
}

beforeAll(async () => {
  vi.stubEnv("ADMIN_ENABLED", "1");
  setAuthStoreForTests();
  await ensureAccount(MODERATOR);
  await grantModerator(MODERATOR, null);
});

describe("聊天风险 in /admin (#384, ADR 0039)", () => {
  it("is for moderators only", async () => {
    const { shop } = await riskyShop();
    await signIn("not.a.moderator@example.com");
    expect(await getChatRiskQueue()).toMatchObject({ refused: "not_moderator" });
    expect(await getChatRiskMessages(shop.id)).toMatchObject({ refused: "not_moderator" });
    expect(await closeChatRiskItem(shop.id)).toMatchObject({ ok: false });
  });

  it("lists the business without its words, hands the messages over recorded, and closes with a log line", async () => {
    const { shop, row } = await riskyShop();
    await signIn(MODERATOR);
    const queue = await getChatRiskQueue();
    const item = "items" in queue ? queue.items.find((i) => i.employerId === shop.id) : undefined;
    expect(item).toMatchObject({ employerName: "押金茶楼", rules: ["fee"], count: 3 });
    expect(JSON.stringify(item)).not.toContain("先交押金");

    const answer = await getChatRiskMessages(shop.id);
    expect("messages" in answer && answer.messages.map((m) => m.text)).toEqual([
      "先交押金 3",
      "先交押金 2",
      "先交押金 1",
    ]);
    const { views } = await listViews({ moderator: MODERATOR, days: 7 });
    expect(views.filter((v) => v.subjectId === row.id).map((v) => v.kind)).toEqual(["chat"]);

    const closed = await closeChatRiskItem(shop.id);
    expect(closed).toEqual({ ok: true, text: "看过并关闭「押金茶楼」的聊天风险 · 标记：收费用词" });
    expect((await listModerationLog())[0]).toMatchObject({ action: "chat_risk_close", moderator: MODERATOR });
    expect(await closeChatRiskItem(shop.id)).toEqual({
      ok: false,
      error_zh: "这一项已经关闭了（可能是别的审核员刚关的）。",
    });
    const after = await getChatRiskQueue();
    expect("items" in after && after.items.some((i) => i.employerId === shop.id)).toBe(false);
  });
});
