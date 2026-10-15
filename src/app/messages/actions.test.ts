import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { createEmployer, ensureAccount, openEmployerIdentity } from "@/lib/data";
import { memoryChatStore, setChatServerStoreForTests } from "@/lib/chat-server/store";
import { databaseChatStore } from "@/db/chat-store";
import { jobNumbers } from "@/db/job-stats";
import { chatDemo } from "@/components/seeker/chat-demo";
import { EMPTY_CHAT, addSentMessage, chatView } from "@/components/seeker/chat-store";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));

const { changeMyChat, importMyChat, markMyNotificationsRead, myChat, myNotificationReads } =
  await import("@/app/messages/actions");

const seekerScope = (email: string) => JSON.stringify([email, "seeker", null]);
// Most checks are about the records; the scope each answer names is checked once below.
const my = async () => (await myChat())?.record ?? null;
const change = async (c: Parameters<typeof changeMyChat>[0]) => (await changeMyChat(c))?.record ?? null;
const importRecord = async (r: unknown) => (await importMyChat(r))?.record ?? null;
const reads = async () => (await myNotificationReads())?.ids ?? null;
const markRead = async (ids: string[] | "all") => (await markMyNotificationsRead(ids))?.ids ?? null;
let store = memoryChatStore();

async function signedIn(email: string, role: "seeker" | "employer" = "seeker") {
  cookies.clear();
  await ensureAccount(email);
  await createSession(email, role, jar);
}

beforeEach(() => {
  setAuthStoreForTests();
  store = memoryChatStore();
  setChatServerStoreForTests(store);
  cookies.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("changes from the browser's outbox (a ticket)", () => {
  const send = { type: "send", conversationId: "north-tea", text: "只发一次" } as const;

  it("are applied once however often they are sent", async () => {
    await signedIn("twice@example.com");
    const ticket = { id: "0b9c1f7e-4d1a-4a5e-9f3c-1c2d3e4f5a6b", scope: seekerScope("twice@example.com") };
    const first = await changeMyChat(send, ticket);
    const again = await changeMyChat(send, ticket);
    expect(first?.record.added["north-tea"]).toHaveLength(1);
    expect(again).toEqual(first);
    expect((await my())?.added["north-tea"]).toHaveLength(1);
    // A new ticket is a new change.
    await changeMyChat(send, { ...ticket, id: "1b9c1f7e-4d1a-4a5e-9f3c-1c2d3e4f5a6b" });
    expect((await my())?.added["north-tea"]).toHaveLength(2);
  });

  it("are applied once with the database store too (#42), even by a new server", async () => {
    setChatServerStoreForTests(databaseChatStore());
    await signedIn("twice.db@example.com");
    const ticket = { id: "3b9c1f7e-4d1a-4a5e-9f3c-1c2d3e4f5a6b", scope: seekerScope("twice.db@example.com") };
    await changeMyChat(send, ticket);
    setChatServerStoreForTests(databaseChatStore()); // the server restarted; the browser sends its outbox again
    await changeMyChat(send, ticket);
    expect((await my())?.added["north-tea"]).toHaveLength(1);
  });

  it("wait while the session is another identity, and refuse a bad id", async () => {
    await signedIn("other@example.com");
    const elsewhere = { id: "2b9c1f7e-4d1a-4a5e-9f3c-1c2d3e4f5a6b", scope: seekerScope("someone@example.com") };
    expect(await changeMyChat(send, elsewhere)).toEqual({
      scope: seekerScope("other@example.com"),
      record: EMPTY_CHAT,
    });
    for (const id of ["short", "x".repeat(65), "has space in it", 7]) {
      const bad = { id, scope: seekerScope("other@example.com") } as unknown as { id: string; scope: string };
      expect((await changeMyChat(send, bad))?.record).toEqual(EMPTY_CHAT);
    }
    expect(await store.getAppliedChanges(seekerScope("other@example.com"))).toBeUndefined();
  });

  it("remember the newest 200 ids", async () => {
    await signedIn("many@example.com");
    const scope = seekerScope("many@example.com");
    for (let i = 0; i < 205; i++) {
      await changeMyChat(
        { type: "read", conversationId: "north-tea" },
        { id: `ticket-${String(i).padStart(4, "0")}`, scope },
      );
    }
    const ids = (await store.getAppliedChanges(scope))!;
    expect(ids).toHaveLength(200);
    expect(ids[0]).toBe("ticket-0005");
  });
});

describe("chat on the server (#10)", () => {
  it("is nothing for a signed-out browser, and empty records for a new account", async () => {
    expect(await my()).toBeNull();
    expect(await change({ type: "send", conversationId: "north-tea", text: "你好" })).toBeNull();
    await signedIn("new@example.com");
    expect(await my()).toEqual(EMPTY_CHAT);
  });

  it("keeps what the account sends and reads, with the server's clock, for every device that signs in", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T09:00:00Z"));
    await signedIn("li@example.com");
    await change({ type: "read", conversationId: "north-tea" });
    const after = await change({ type: "send", conversationId: "north-tea", text: " 我下午有空 " });
    expect(after?.added["north-tea"]).toEqual([
      { from: "me", text: "我下午有空", time: "刚刚", sentAt: "2026-10-15T09:00:00.000Z" },
    ]);
    expect(after?.readAt["north-tea"]).toBe("2026-10-15T09:00:00.000Z");

    await signedIn("li@example.com"); // another device: a new session, same account
    expect(await myChat()).toEqual({ scope: seekerScope("li@example.com"), record: after });
    expect(store.chats.get(seekerScope("li@example.com"))).toEqual(after);
  });

  it("refuses changes that do not fit: unknown conversations, empty or long text, bad exchange kinds", async () => {
    await signedIn("careful@example.com");
    for (const bad of [
      { type: "send", conversationId: "nobody", text: "你好" },
      { type: "send", conversationId: "north-tea", text: "   " },
      { type: "send", conversationId: "north-tea", text: "字".repeat(2001) },
      { type: "request", conversationId: "north-tea", kind: "address", payload: { title: "地址", fields: [] } },
      { type: "open", conversation: { id: "employer:e1:nope" } },
      "send",
    ]) {
      expect(await change(bad as never)).toEqual(EMPTY_CHAT);
    }
  });

  it("keeps the identities apart: the employer side of an account has its own chat", async () => {
    await signedIn("two.hats@example.com");
    await change({ type: "send", conversationId: "north-tea", text: "求职身份的消息" });
    const shop = await createEmployer({ name: "两顶帽子", regionId: "akl-cbd" });
    await openEmployerIdentity("two.hats@example.com", shop.id);
    await signedIn("two.hats@example.com", "employer");
    expect(await my()).toEqual(EMPTY_CHAT);
    expect(await change({ type: "send", conversationId: "north-tea", text: "x" })).toEqual(EMPTY_CHAT); // not an employer conversation
    const sent = await change({ type: "send", conversationId: "candidate-lin", text: "雇主身份的消息" });
    expect(sent?.added["candidate-lin"]?.[0].text).toBe("雇主身份的消息");
  });

  it("answers a demo exchange with the account's offer, and builds a report's evidence from its own records", async () => {
    await signedIn("answer@example.com");
    const demoId = chatDemo(false).exchanges["north-tea"][0].id;
    const offer = { title: "联系方式", fields: [{ label: "电话", value: "021 555 0001" }] };
    const answered = await change({
      type: "answer",
      conversationId: "north-tea",
      exchangeId: demoId,
      status: "accepted",
      payload: offer,
    });
    expect(chatView(answered!, chatDemo(false)).exchanges["north-tea"][0]).toMatchObject({
      status: "accepted",
      response: offer,
    });
    const reported = await change({
      type: "report",
      conversationId: "north-tea",
      reason: "fraud",
      note: "可疑",
      messageIndex: 0,
    });
    expect(reported?.reports).toHaveLength(1);
    expect(reported?.reports[0]).toMatchObject({
      conversationId: "north-tea",
      targetName: "北岸早茶酒家",
      targetRole: "employer",
      evidence: [chatDemo(false).messages["north-tea"][0]],
    });
    // A report on one of my own messages is not accepted.
    await change({ type: "send", conversationId: "north-tea", text: "我的消息" });
    const view = chatView((await my())!, chatDemo(false));
    const mine = view.messages["north-tea"].length - 1;
    const refused = await change({
      type: "report",
      conversationId: "north-tea",
      reason: "fraud",
      note: "",
      messageIndex: mine,
    });
    expect(refused?.reports).toHaveLength(1);
  });

  it("opens a chat with an employer about one of its active jobs only", async () => {
    await signedIn("asker@example.com");
    const opened = await change({ type: "open", conversation: { kind: "employer", jobId: "j1" } });
    expect(opened?.extra[0]).toMatchObject({ id: "employer:e1:j1", person: "川味小馆", job: "j1", employerId: "e1" });
    expect(await change({ type: "open", conversation: { kind: "employer", jobId: "j17" } })).toEqual(opened); // expired
  });

  it("counts a job seeker's first message about a job on the employer's numbers, once (#55)", async () => {
    const before = (await jobNumbers(["j2"])).j2.chats;
    await signedIn("counted.asker@example.com");
    await change({ type: "open", conversation: { kind: "employer", jobId: "j2" } });
    expect((await jobNumbers(["j2"])).j2.chats).toBe(before); // opening alone is not a chat yet
    const id = (await my())!.extra.find((c) => c.job === "j2")!.id;
    await change({ type: "send", conversationId: id, text: "你好" });
    await change({ type: "send", conversationId: id, text: "还在招吗" });
    expect((await jobNumbers(["j2"])).j2.chats).toBe(before + 1);
  });

  it("takes the browser's older records once, when the server has none for that identity", async () => {
    await signedIn("upload@example.com");
    const local = addSentMessage(EMPTY_CHAT, "north-tea", "本机的消息", "2026-10-14T01:00:00.000Z");
    expect(await importRecord(local)).toEqual(local);
    expect(await importRecord(addSentMessage(EMPTY_CHAT, "mt-eden", "第二次", "2026-10-14T02:00:00.000Z"))).toEqual(
      local,
    );
    expect(await importRecord({ junk: true })).toEqual(local);
  });
});

describe("notifications on the server (#10)", () => {
  it("remembers which ones the identity has read, and only ids the demo has", async () => {
    expect(await reads()).toBeNull();
    await signedIn("reader@example.com");
    expect(await reads()).toEqual([]);
    expect(await markRead(["n1", "n1", "made-up"])).toEqual(["n1"]);
    expect(await markRead("all")).toEqual(["n1", "n2", "n3"]);
  });
});
