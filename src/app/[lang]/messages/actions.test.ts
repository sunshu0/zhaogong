import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createSession, type CookieJar } from "@/lib/auth";
import { setAuthStoreForTests } from "@/lib/auth/store";
import { createEmployer, createJob, ensureAccount, openEmployerIdentity } from "@/lib/data";
import { createJobAlert, matchJobAlerts } from "@/db/job-alerts";
import { MOCK_JOBS } from "@/mock/data";
import type { Job } from "@/lib/types";
import { memoryChatStore, setChatServerStoreForTests } from "@/lib/chat-server/store";
import { databaseChatStore } from "@/db/chat-store";
import { answerInvite, inviteToTeam, setTeamName } from "@/db/team";
import { jobNumbers } from "@/db/job-stats";
import { chatDemo } from "@/components/seeker/chat-demo";
import { EMPTY_CHAT, addSentMessage, chatView, type ChatRecord } from "@/components/seeker/chat-store";
import { addApplication } from "@/db/job-applications";
import { saveSeekerProfile } from "@/db/seeker-profiles";
import { teamChatScope } from "@/lib/chat-server/identity";
import { mergeSharedChanges } from "@/lib/chat-server/shared-view";
import { SHARED_MESSAGES_MAX, resumeInChat } from "@/db/conversations";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { insertsInChunks } from "@/db/write-if";

// Server Functions read the request's cookies; here one jar stands in for one browser.
const cookies = new Map<string, string>();
const jar: CookieJar = {
  get: (name) => (cookies.has(name) ? { name, value: cookies.get(name)! } : undefined),
  set: (name, value) => void cookies.set(name, value),
  delete: (name) => void cookies.delete(name),
};
vi.mock("next/headers", () => ({ cookies: async () => jar }));
const push = vi.hoisted(() => ({ configured: false, callbacks: [] as (() => Promise<void>)[], deliver: vi.fn() }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: (callback: () => Promise<void>) => { push.callbacks.push(callback); } }));
vi.mock("@/lib/push/web-push", () => ({ vapidConfig: () => push.configured ? {} : undefined }));
vi.mock("@/lib/push/delivery", () => ({ deliverChatPush: push.deliver }));

const { changeMyChat, importMyChat, markMyNotificationsRead, myChat, myChatChanges, myNotificationReads } =
  await import("@/app/[lang]/messages/actions");
type ChatChange = Parameters<typeof changeMyChat>[0];
const { myAlertNotifications } = await import("@/app/[lang]/me/alerts/actions");

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
  push.configured = false;
  push.callbacks.length = 0;
  push.deliver.mockReset().mockResolvedValue(undefined);
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
    await signedIn("demo.twice@example.com");
    const ticket = { id: "0b9c1f7e-4d1a-4a5e-9f3c-1c2d3e4f5a6b", scope: seekerScope("demo.twice@example.com") };
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
    await signedIn("demo.twice.db@example.com");
    const ticket = { id: "3b9c1f7e-4d1a-4a5e-9f3c-1c2d3e4f5a6b", scope: seekerScope("demo.twice.db@example.com") };
    await changeMyChat(send, ticket);
    setChatServerStoreForTests(databaseChatStore()); // the server restarted; the browser sends its outbox again
    await changeMyChat(send, ticket);
    expect((await my())?.added["north-tea"]).toHaveLength(1);
  });

  it("wait while the session is another identity, and refuse a bad id", async () => {
    await signedIn("demo.other@example.com");
    const elsewhere = { id: "2b9c1f7e-4d1a-4a5e-9f3c-1c2d3e4f5a6b", scope: seekerScope("demo.someone@example.com") };
    expect(await changeMyChat(send, elsewhere)).toEqual({
      scope: seekerScope("demo.other@example.com"),
      record: EMPTY_CHAT,
    });
    for (const id of ["short", "x".repeat(65), "has space in it", 7]) {
      const bad = { id, scope: seekerScope("demo.other@example.com") } as unknown as { id: string; scope: string };
      expect((await changeMyChat(send, bad))?.record).toEqual(EMPTY_CHAT);
    }
    expect(await store.getAppliedChanges(seekerScope("demo.other@example.com"))).toBeUndefined();
  });

  it("remember the newest 200 ids", async () => {
    await signedIn("demo.many@example.com");
    const scope = seekerScope("demo.many@example.com");
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
    await signedIn("demo.new@example.com");
    expect(await my()).toEqual(EMPTY_CHAT);
  });

  it("keeps what the account sends and reads, with the server's clock, for every device that signs in", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T09:00:00Z"));
    await signedIn("demo.li@example.com");
    await change({ type: "read", conversationId: "north-tea" });
    const after = await change({ type: "send", conversationId: "north-tea", text: " 我下午有空 " });
    expect(after?.added["north-tea"]).toEqual([
      { from: "me", text: "我下午有空", time: "刚刚", sentAt: "2026-10-15T09:00:00.000Z" },
    ]);
    expect(after?.readAt["north-tea"]).toBe("2026-10-15T09:00:00.000Z");

    await signedIn("demo.li@example.com"); // another device: a new session, same account
    expect(await myChat()).toEqual({ scope: seekerScope("demo.li@example.com"), record: after });
    expect(store.chats.get(seekerScope("demo.li@example.com"))).toEqual(after);
  });

  it("refuses changes that do not fit: unknown conversations, empty or long text, bad exchange kinds", async () => {
    await signedIn("demo.careful@example.com");
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
    await signedIn("demo.two.hats@example.com");
    await change({ type: "send", conversationId: "north-tea", text: "求职身份的消息" });
    const shop = await createEmployer({ name: "两顶帽子", regionId: "akl-cbd" });
    await openEmployerIdentity("demo.two.hats@example.com", shop.id);
    await signedIn("demo.two.hats@example.com", "employer");
    expect(await my()).toEqual(EMPTY_CHAT);
    expect(await change({ type: "send", conversationId: "north-tea", text: "x" })).toEqual(EMPTY_CHAT); // not an employer conversation
    const sent = await change({ type: "send", conversationId: "candidate-lin", text: "雇主身份的消息" });
    expect(sent?.added["candidate-lin"]?.[0].text).toBe("雇主身份的消息");
  });

  it("shares a business's chats with its whole team, each message saying who sent it (#87)", async () => {
    const shop = await createEmployer({ name: "团队茶楼", regionId: "akl-cbd" });
    await ensureAccount("demo.team.chat.boss@example.com");
    await openEmployerIdentity("demo.team.chat.boss@example.com", shop.id);
    // The founder's chats from before #87 were its own; the business starts from them.
    await signedIn("demo.team.chat.boss@example.com", "employer");
    const ownScope = JSON.stringify(["demo.team.chat.boss@example.com", "employer", shop.id]);
    await store.putChat(
      ownScope,
      addSentMessage(EMPTY_CHAT, "candidate-lin", "以前的消息", "2026-10-16T00:00:00.000Z"),
    );
    expect((await my())?.added["candidate-lin"]?.map((m) => m.text)).toEqual(["以前的消息"]);
    await setTeamName("demo.team.chat.boss@example.com", "王老板");
    await change({ type: "send", conversationId: "candidate-lin", text: "老板的回复" });

    await ensureAccount("demo.team.chat.staff@example.com");
    const invited = await inviteToTeam(
      shop.id,
      "demo.team.chat.boss@example.com",
      "demo.team.chat.staff@example.com",
      "member",
    );
    if (invited.status !== "invited") throw new Error(invited.status);
    await answerInvite("demo.team.chat.staff@example.com", invited.invite.id, { accept: true, name: "小李" });
    await signedIn("demo.team.chat.staff@example.com", "employer");
    await change({ type: "send", conversationId: "candidate-lin", text: "店员的回复" });

    const messages = (await my())?.added["candidate-lin"] ?? [];
    expect(messages.map((m) => [m.text, m.by])).toEqual([
      ["以前的消息", undefined],
      ["老板的回复", "王老板"],
      ["店员的回复", "小李"],
    ]);
    // Each answer still names the person's own identity, for the browser's copy.
    expect((await myChat())?.scope).toBe(JSON.stringify(["demo.team.chat.staff@example.com", "employer", shop.id]));
    await signedIn("demo.team.chat.boss@example.com", "employer");
    expect((await my())?.added["candidate-lin"]).toHaveLength(3);
  });

  it("answers a demo exchange with the account's offer, and builds a report's evidence from its own records", async () => {
    await signedIn("demo.answer@example.com");
    const demoId = chatDemo(false, true).exchanges["north-tea"][0].id;
    const offer = { title: "联系方式", fields: [{ label: "电话", value: "09 055 0001" }] };
    const answered = await change({
      type: "answer",
      conversationId: "north-tea",
      exchangeId: demoId,
      status: "accepted",
      payload: offer,
    });
    expect(chatView(answered!, chatDemo(false, true)).exchanges["north-tea"][0]).toMatchObject({
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
      evidence: [chatDemo(false, true).messages["north-tea"][0]],
    });
    // A report on one of my own messages is not accepted.
    await change({ type: "send", conversationId: "north-tea", text: "我的消息" });
    const view = chatView((await my())!, chatDemo(false, true));
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

  it("keeps at most 100 chat reports in the own record, and says so (a size of the own record)", async () => {
    await signedIn("demo.reporter@example.com");
    const report = { type: "report", conversationId: "north-tea", reason: "fraud", note: "", messageIndex: 0 } as const;
    const first = (await change(report))!;
    const scope = seekerScope("demo.reporter@example.com");
    await store.putChat(scope, {
      ...first,
      reports: Array.from({ length: 99 }, (_, i) => ({ ...first.reports[0], id: `r${i}` })),
    });

    const hundredth = await changeMyChat(report);
    expect(hundredth?.notice).toBeUndefined();
    expect(hundredth?.record.reports).toHaveLength(100);
    const over = await changeMyChat(report);
    expect(over?.notice).toBe("你已经保存了 100 条聊天举报，到上限了，这次举报没有保存。");
    expect(store.chats.get(scope)?.reports).toHaveLength(100);
    cookies.set("zg_lang", "en");
    expect((await changeMyChat(report))?.notice).toBe(
      "You already have 100 chat reports saved, the most allowed, so this one wasn't saved.",
    );
    // Other changes still go through.
    expect(
      (await change({ type: "send", conversationId: "north-tea", text: "还能发消息" }))?.added["north-tea"],
    ).toHaveLength(1);
  });

  it("opens a chat with an employer about one of its active jobs only", async () => {
    await signedIn("demo.asker@example.com");
    const opened = await change({ type: "open", conversation: { kind: "employer", jobId: "j1" } });
    expect(opened?.extra[0]).toMatchObject({ id: "employer:e1:j1", person: "川味小馆", job: "j1", employerId: "e1" });
    expect(await change({ type: "open", conversation: { kind: "employer", jobId: "j17" } })).toEqual(opened); // expired
  });

  it("counts a job seeker's first message about a job on the employer's numbers, once (#55)", async () => {
    const before = (await jobNumbers(["j2"])).j2.chats;
    await signedIn("demo.counted.asker@example.com");
    await change({ type: "open", conversation: { kind: "employer", jobId: "j2" } });
    expect((await jobNumbers(["j2"])).j2.chats).toBe(before); // opening alone is not a chat yet
    const id = (await my())!.extra.find((c) => c.job === "j2")!.id;
    await change({ type: "send", conversationId: id, text: "你好" });
    await change({ type: "send", conversationId: id, text: "还在招吗" });
    expect((await jobNumbers(["j2"])).j2.chats).toBe(before + 1);
  });

  it("takes the browser's older records once, when the server has none for that identity", async () => {
    await signedIn("demo.upload@example.com");
    const local = addSentMessage(EMPTY_CHAT, "north-tea", "本机的消息", "2026-10-14T01:00:00.000Z");
    expect(await importRecord(local)).toEqual(local);
    expect(await importRecord(addSentMessage(EMPTY_CHAT, "mt-eden", "第二次", "2026-10-14T02:00:00.000Z"))).toEqual(
      local,
    );
    expect(await importRecord({ junk: true })).toEqual(local);
  });

  it("adds at most 200 messages to a conversation of the own record, and says so (security review F)", async () => {
    await signedIn("demo.full@example.com");
    let full = EMPTY_CHAT;
    for (let i = 1; i < 200; i++) full = addSentMessage(full, "north-tea", `第 ${i} 条`, "2026-10-14T01:00:00.000Z");
    expect(await importRecord(full)).toEqual(full);
    const last = await changeMyChat({ type: "send", conversationId: "north-tea", text: "第 200 条" });
    expect(last?.record.added["north-tea"]).toHaveLength(200);
    expect(last?.notice).toBeUndefined();
    const over = await changeMyChat({ type: "send", conversationId: "north-tea", text: "第 201 条" });
    expect(over?.record.added["north-tea"]).toHaveLength(200);
    expect(over?.notice).toBe("这段对话里已经有 200 条消息，到上限了，这条没有发出。");
    cookies.set("zg_lang", "en");
    expect((await changeMyChat({ type: "send", conversationId: "north-tea", text: "again" }))?.notice).toBe(
      "This conversation already has 200 messages, the most it can hold, so this one wasn't sent.",
    );
    expect(
      (await change({ type: "send", conversationId: "mt-eden", text: "另一段对话" }))?.added["mt-eden"],
    ).toHaveLength(1);
  });

  it("does not take an older record over the own record's sizes, and says so (security review F)", async () => {
    const at = "2026-10-14T01:00:00.000Z";
    const messages = (n: number, text = "一条") =>
      Array.from({ length: n }, () => ({ from: "me" as const, text, time: "刚刚", sentAt: at }));
    const report = (text: string) => ({
      id: "r1",
      conversationId: "north-tea",
      targetName: "北岸茶餐厅",
      targetRole: "employer",
      reason: "fraud",
      note: "",
      evidence: [{ from: "them", text, time: "昨天" }],
      createdAt: at,
    });
    const tooBig: [string, ChatRecord][] = [
      ["201 messages in one conversation", { ...EMPTY_CHAT, added: { "north-tea": messages(201) } }],
      [
        "101 conversations",
        { ...EMPTY_CHAT, readAt: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`c${i}`, at])) },
      ],
      ["a message over 2000 characters", { ...EMPTY_CHAT, added: { "north-tea": messages(1, "字".repeat(2001)) } }],
      ["101 reports", { ...EMPTY_CHAT, reports: Array.from({ length: 101 }, () => report("骗子")) } as ChatRecord],
      ["evidence over 2000 characters", { ...EMPTY_CHAT, reports: [report("字".repeat(2001))] } as ChatRecord],
    ];
    for (const [what, record] of tooBig) {
      await signedIn(`demo.import.${tooBig.findIndex(([w]) => w === what)}@example.com`);
      const answer = await importMyChat(record);
      expect(answer?.record, what).toEqual(EMPTY_CHAT);
      expect(answer?.notice, what).toBe("这台设备上的旧聊天记录太多，没有存到服务器。");
      expect(await my(), what).toEqual(EMPTY_CHAT);
    }
    // Just inside every size, it is taken.
    await signedIn("demo.import.fits@example.com");
    const fits: ChatRecord = {
      ...EMPTY_CHAT,
      added: { "north-tea": messages(200, "字".repeat(2000)) },
      readAt: Object.fromEntries(Array.from({ length: 99 }, (_, i) => [`c${i}`, at])),
      reports: Array.from({ length: 100 }, () => report("骗子")) as ChatRecord["reports"],
    };
    const taken = await importMyChat(fits);
    expect(taken?.notice).toBeUndefined();
    expect(await my()).toEqual(taken?.record);
    expect(taken?.record.added["north-tea"]).toHaveLength(200);
  });
});

describe("notifications on the server (#10)", () => {
  it("remembers which ones the identity has read, and only ids the demo has", async () => {
    expect(await reads()).toBeNull();
    await signedIn("demo.reader@example.com");
    expect(await reads()).toEqual([]);
    expect(await markRead(["n1", "n1", "made-up"])).toEqual(["n1"]);
    expect(await markRead("all")).toEqual(["n1", "n2", "n3"]);
  });

  it("has no demo notifications or demo chats for an account that is not a demo one (#110)", async () => {
    await signedIn("real.person@example.com");
    expect(await markRead("all")).toEqual([]);
    expect(await change({ type: "send", conversationId: "north-tea", text: "你好" })).toEqual(EMPTY_CHAT);
    await signedIn("real.person@example.com", "employer");
    expect(await change({ type: "read", conversationId: "candidate-lin" })).toEqual(EMPTY_CHAT);
  });

  /** A job of the business, open for `days` more days, under a title only this test uses. */
  async function jobOf(employerId: string, titleZh: string, days: number): Promise<Job> {
    const job: Partial<Job> = { ...MOCK_JOBS[0], employerId, titleZh, status: "active" };
    delete job.id;
    job.expiresAt = new Date(Date.now() + days * 86_400_000).toISOString();
    return createJob(job as Omit<Job, "id">);
  }

  it("keeps a 快截止 notice read after a restart (#94)", async () => {
    setChatServerStoreForTests(databaseChatStore());
    const shop = await createEmployer({ name: "截止提醒小店", regionId: "akl-cbd" });
    await openEmployerIdentity("demo.closing.reader@example.com", shop.id);
    await jobOf(shop.id, "两天后截止的职位", 2);
    await signedIn("demo.closing.reader@example.com", "employer");
    const [closing] = (await myAlertNotifications())!.items.filter((n) => n.id.startsWith("closing:"));
    expect(closing.title).toBe("「两天后截止的职位」2 天后截止");
    expect(await markRead([closing.id])).toContain(closing.id);

    setChatServerStoreForTests(databaseChatStore()); // a new store, as after the server restarts
    expect(await reads()).toContain(closing.id);
  });

  it("lets every notification the server shows be marked read, for both identities (#94)", async () => {
    const shop = await createEmployer({ name: "通知齐全小店", regionId: "akl-cbd" });
    await openEmployerIdentity("demo.all.kinds@example.com", shop.id);
    await jobOf(shop.id, "快截止", 1);
    await createJobAlert("demo.all.kinds@example.com", { name: "全部", country: "NZ", query: "q=提醒都能已读" });
    await matchJobAlerts(await jobOf("e2", "提醒都能已读", 30));

    for (const role of ["employer", "seeker"] as const) {
      await signedIn("demo.all.kinds@example.com", role);
      const shown = (await myAlertNotifications())!.items.map((n) => n.id);
      expect(shown.length).toBeGreaterThan(0);
      expect(await markRead(shown)).toEqual(expect.arrayContaining(shown));
    }
  });
});

describe("chats both sides share (#110)", () => {
  const PAGE = {
    name: "小王",
    headline: "",
    location: "",
    languages: "",
    availability: "",
    bio: "",
    resume: { employmentTypes: [], regionIds: [], skills: "" },
  };

  /** A business with an admin (王老板) and a member (小李), and one open job. */
  async function business(tag: string) {
    const shop = await createEmployer({ name: `${tag}茶楼`, regionId: "akl-cbd" });
    const boss = `demo.${tag}.boss@example.com`;
    const staff = `${tag}.staff@example.com`;
    await ensureAccount(boss);
    await openEmployerIdentity(boss, shop.id);
    await setTeamName(boss, "王老板");
    await ensureAccount(staff);
    const invited = await inviteToTeam(shop.id, boss, staff, "member");
    if (invited.status !== "invited") throw new Error(invited.status);
    await answerInvite(staff, invited.invite.id, { accept: true, name: "小李" });
    const job: Partial<Job> = { ...MOCK_JOBS[0], employerId: shop.id, titleZh: `${tag}服务员`, status: "active" };
    delete job.id;
    job.expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    return { shop, boss, staff, job: await createJob(job as Omit<Job, "id">) };
  }

  it("schedules push only after a new shared message/resume; retries, reads and empty sends do not schedule", async () => {
    const { shop, job } = await business("push");
    const email = "push.seeker@example.com";
    const conversationId = `employer:${shop.id}:${job.id}`;
    await signedIn(email);
    push.configured = true;
    const ticket = { id: "push-ticket-once", scope: seekerScope(email) };
    await changeMyChat({ type: "send", conversationId, text: "你好" }, ticket);
    expect(push.callbacks).toHaveLength(1);
    expect(push.deliver).not.toHaveBeenCalled(); // still after the response, never inline with the insert
    await changeMyChat({ type: "send", conversationId, text: "你好" }, ticket);
    await change({ type: "read", conversationId });
    await change({ type: "send", conversationId, text: " " });
    await myChat(); await myChatChanges(undefined);
    expect(push.callbacks).toHaveLength(1);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    push.deliver.mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(push.callbacks[0]()).resolves.toBeUndefined();
    expect((await my())?.added[conversationId]).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(JSON.stringify({ event: "chat_push", failed: true }));
    warn.mockRestore();
    await change({ type: "resume", conversationId, resume: { zh: { name: "测试" } } });
    expect(push.callbacks).toHaveLength(2);
    push.configured = false;
    await change({ type: "send", conversationId, text: "配置未开放仍能聊天" });
    expect(push.callbacks).toHaveLength(2);
  });

  it("a job seeker and a whole team talk in one conversation, with read receipts and who sent what", async () => {
    const { shop, boss, staff, job } = await business("shared");
    const seekerId = `employer:${shop.id}:${job.id}`;

    await signedIn("shared.seeker@example.com");
    const opened = await changeMyChat({ type: "open", conversation: { kind: "employer", jobId: job.id } });
    expect(opened?.opened).toBe(seekerId);
    await change({ type: "send", conversationId: seekerId, text: "你好，还招人吗？" });

    await signedIn(staff, "employer");
    const staffSees = (await my())!;
    const conversation = staffSees.extra.find((c) => c.job === job.id)!;
    expect(conversation).toMatchObject({ person: "求职者", title: "shared服务员" });
    expect(conversation.id).toMatch(/^chat:/);
    expect(chatView(staffSees, chatDemo(true, false)).unread[conversation.id]).toBe(1);
    await change({ type: "read", conversationId: conversation.id });
    await change({ type: "send", conversationId: conversation.id, text: "还招，明天来面试吧" });

    await signedIn(boss, "employer");
    const bossSees = (await my())!;
    expect(bossSees.added[conversation.id].map((m) => [m.from, m.text, m.by])).toEqual([
      ["them", "你好，还招人吗？", undefined],
      ["me", "还招，明天来面试吧", "小李"],
    ]);
    await change({ type: "send", conversationId: conversation.id, text: "地址在皇后街" });

    await signedIn("shared.seeker@example.com");
    const seekerSees = (await my())!;
    const thread = chatView(seekerSees, chatDemo(false, false)).messages[seekerId];
    expect(thread.map((m) => [m.from, m.text, m.by])).toEqual([
      ["me", "你好，还招人吗？", undefined],
      ["them", "还招，明天来面试吧", "小李"],
      ["them", "地址在皇后街", "王老板"],
    ]);
    expect(thread[0].readAt).toBeTruthy(); // the business read it
    expect(chatView(seekerSees, chatDemo(false, false)).unread[seekerId]).toBe(2);
    expect(store.chats.get(seekerScope("shared.seeker@example.com"))).toBeUndefined(); // nothing in its own record

    // Another business sees none of it, and cannot write to it.
    const other = await createEmployer({ name: "别家", regionId: "akl-cbd" });
    await ensureAccount("demo.other.shop@example.com");
    await openEmployerIdentity("demo.other.shop@example.com", other.id);
    await signedIn("demo.other.shop@example.com", "employer");
    expect((await my())!.extra.some((c) => c.id === conversation.id)).toBe(false);
    await change({ type: "send", conversationId: conversation.id, text: "插一句" });
    await signedIn(boss, "employer");
    expect((await my())!.added[conversation.id]).toHaveLength(3);
  });

  it("records the business's messages that hit the chat rules, never the job seeker's (#384, ADR 0039)", async () => {
    const { shop, boss, job } = await business("risk");
    const seekerId = `employer:${shop.id}:${job.id}`;
    await signedIn("risk.seeker@example.com");
    await changeMyChat({ type: "open", conversation: { kind: "employer", jobId: job.id } });
    await change({ type: "send", conversationId: seekerId, text: "要先交押金吗？" });

    await signedIn(boss, "employer");
    const conversation = (await my())!.extra.find((c) => c.job === job.id)!;
    await change({ type: "send", conversationId: conversation.id, text: "我们不收押金" });
    await change({ type: "send", conversationId: conversation.id, text: "入职前先交押金 200，另外可以刷单" });

    const hits = await (await database()).select().from(t.chatRiskHits).where(eq(t.chatRiskHits.employerId, shop.id));
    expect(hits.map((h) => h.rules)).toEqual([["fee", "task_scam"]]);
    const [message] = await (await database()).select().from(t.messages).where(eq(t.messages.id, hits[0].messageId));
    expect(message).toMatchObject({ from: "employer", text: "入职前先交押金 200，另外可以刷单", byName: "王老板" });
  });

  it("the business's 发起聊天 on an applicant opens the conversation the job seeker has", async () => {
    const { shop, boss, job } = await business("applied");
    await ensureAccount("applied.seeker@example.com");
    const application = await addApplication({
      email: "applied.seeker@example.com",
      jobId: job.id,
      employerId: shop.id,
      note: "",
      profile: PAGE,
    });
    if (application === "already") throw new Error("fresh application expected");

    await signedIn(boss, "employer");
    const open: ChatChange = {
      type: "open",
      conversation: { kind: "applicant", jobId: job.id, applicationId: application.id },
    };
    const first = await changeMyChat(open);
    expect(first?.opened).toMatch(/^chat:/);
    expect((await changeMyChat(open))?.opened).toBe(first?.opened);
    expect(first?.record.extra[0]).toMatchObject({ id: first?.opened, person: "小王" });

    // Nothing for the job seeker until something is said.
    await signedIn("applied.seeker@example.com");
    expect((await my())!.extra).toEqual([]);
    await signedIn(boss, "employer");
    await change({ type: "send", conversationId: first!.opened!, text: "看了你的申请" });
    await signedIn("applied.seeker@example.com");
    const seekerId = `employer:${shop.id}:${job.id}`;
    expect((await my())!.added[seekerId].map((m) => m.text)).toEqual(["看了你的申请"]);
    expect((await changeMyChat({ type: "open", conversation: { kind: "employer", jobId: job.id } }))?.opened).toBe(
      seekerId,
    );
  });

  it("exchanges follow R-12 for both sides: the asker offers first and sees the answer only when accepted", async () => {
    const { shop, boss, job } = await business("swap");
    const seekerId = `employer:${shop.id}:${job.id}`;
    await signedIn("swap.seeker@example.com");
    await changeMyChat({ type: "open", conversation: { kind: "employer", jobId: job.id } });
    const offer = { title: "联系方式", fields: [{ label: "电话", value: "021 555 0002" }] };
    await change({ type: "request", conversationId: seekerId, kind: "contact", payload: offer });
    await change({ type: "request", conversationId: seekerId, kind: "contact", payload: offer }); // one at a time

    await signedIn(boss, "employer");
    const seen = (await my())!;
    const id = seen.extra.find((c) => c.job === job.id)!.id;
    expect(seen.exchanges[id]).toEqual([expect.objectContaining({ from: "them", status: "pending", offered: offer })]);
    const answer = { title: "联系方式", fields: [{ label: "微信", value: "swapshop" }] };
    const exchangeId = seen.exchanges[id][0].id;
    await change({ type: "answer", conversationId: id, exchangeId, status: "accepted", payload: answer });

    await signedIn("swap.seeker@example.com");
    const back = (await my())!.exchanges[seekerId];
    expect(back).toEqual([
      expect.objectContaining({ from: "me", status: "accepted", offered: offer, response: answer }),
    ]);
    // An answer already given is not given again.
    await change({ type: "answer", conversationId: seekerId, exchangeId, status: "cancelled" });
    expect((await my())!.exchanges[seekerId][0].status).toBe("accepted");
  });

  it("a request withdrawn and made again over and over keeps at most three of a kind in the conversation (#366)", async () => {
    const { shop, boss, job } = await business("again");
    const seekerId = `employer:${shop.id}:${job.id}`;
    await signedIn("again.seeker@example.com");
    await changeMyChat({ type: "open", conversation: { kind: "employer", jobId: job.id } });
    const offer = { title: "联系方式", fields: [{ label: "电话", value: "021 555 0004" }] };
    for (let i = 0; i < 6; i++) {
      const asked = await change({ type: "request", conversationId: seekerId, kind: "contact", payload: offer });
      const pending = asked!.exchanges[seekerId].find((x) => x.status === "pending")!;
      await change({ type: "answer", conversationId: seekerId, exchangeId: pending.id, status: "cancelled" });
    }
    const db = await database();
    const conversation = (await db.select().from(t.conversations).where(eq(t.conversations.employerId, shop.id)))[0];
    const rows = await db.select().from(t.exchanges).where(eq(t.exchanges.conversationId, conversation.id));
    expect(rows.map((r) => r.status)).toEqual(["cancelled", "cancelled", "cancelled"]);

    // Both sides still see a withdrawn request as before, and a new one can be made.
    await change({ type: "request", conversationId: seekerId, kind: "contact", payload: offer });
    // (Requests made in the same millisecond have no order between them: compared sorted.)
    const statuses = (list: { status: string }[]) => list.map((x) => x.status).sort();
    expect(statuses((await my())!.exchanges[seekerId])).toEqual(["cancelled", "cancelled", "pending"]);
    await signedIn(boss, "employer");
    const seen = (await my())!;
    const id = seen.extra.find((c) => c.job === job.id)!.id;
    expect(statuses(seen.exchanges[id])).toEqual(["cancelled", "cancelled", "pending"]);
    expect(seen.exchanges[id].every((x) => x.from === "them")).toBe(true);
  });

  it("a job seeker sends their 中英文简历: the team gets a card, and only the two sides open the page as sent (#379)", async () => {
    const { shop, boss, staff, job } = await business("resume");
    const seekerId = `employer:${shop.id}:${job.id}`;
    const page = {
      zh: { name: " 林晓 ", headline: "前厅" },
      contact: { phone: "021 555 0003", email: "lin@example.com", wechat: "" },
    };
    // Sent before anything else, it starts the conversation, like a first message.
    await signedIn("resume.seeker@example.com");
    await change({ type: "resume", conversationId: seekerId, resume: page });
    await change({ type: "resume", conversationId: seekerId, resume: { zh: { name: " " } } }); // no name: nothing
    await change({ type: "resume", conversationId: "north-tea", resume: page }); // never to a demo chat
    const [mine] = (await my())!.added[seekerId];
    expect(mine).toMatchObject({ from: "me", text: "[简历] 林晓" });
    expect(mine.resume).toEqual({ id: expect.any(Number), name: "林晓", contact: ["phone", "email"] });
    expect((await my())!.added["north-tea"]).toBeUndefined();

    await signedIn(staff, "employer");
    const seen = (await my())!;
    const id = seen.extra.find((c) => c.job === job.id)!.id;
    expect(seen.added[id]).toEqual([expect.objectContaining({ from: "them", resume: mine.resume })]);
    expect(JSON.stringify(seen)).not.toContain("021 555 0003"); // the card, not the page
    // A business sends no résumé into the chat.
    await change({ type: "resume", conversationId: id, resume: page });
    expect((await my())!.added[id]).toHaveLength(1);

    // The page as sent, contact details as ticked (the email too), for the job seeker and the whole team only.
    const sent = await resumeInChat({ side: "employer", employerId: shop.id }, mine.resume!.id);
    expect(sent?.resume.zh.name).toBe("林晓");
    expect(sent?.resume.contact).toEqual({ phone: "021 555 0003", email: "lin@example.com" });
    expect(sent?.employerName).toBe(shop.name);
    expect(await resumeInChat({ side: "seeker", email: "RESUME.seeker@example.com" }, mine.resume!.id)).toBeTruthy();
    expect(await resumeInChat({ side: "seeker", email: "someone@example.com" }, mine.resume!.id)).toBeUndefined();
    const other = await createEmployer({ name: "别家简历", regionId: "akl-cbd" });
    expect(await resumeInChat({ side: "employer", employerId: other.id }, mine.resume!.id)).toBeUndefined();
    // A message that is not a résumé, or no message at all, is nothing.
    await signedIn(boss, "employer");
    await change({ type: "send", conversationId: id, text: "收到" });
    expect(await resumeInChat({ side: "employer", employerId: shop.id }, mine.resume!.id + 1)).toBeUndefined();
    expect(await resumeInChat({ side: "employer", employerId: shop.id }, 0)).toBeUndefined();
  });

  it("a 推荐人才 candidate with a page on their account shares the chat; a demo candidate stays the business's own", async () => {
    const { boss, job } = await business("found");
    await ensureAccount("found.seeker@example.com");
    await saveSeekerProfile("found.seeker@example.com", {
      ...PAGE,
      name: "陈晨",
      resume: { employmentTypes: [], regionIds: [], skills: "", candidateId: "found1", discoverable: true },
    });
    await signedIn(boss, "employer");
    const shared = await changeMyChat({
      type: "open",
      conversation: { kind: "candidate", jobId: job.id, candidateId: "local-found1", name: "随便写的" },
    });
    expect(shared?.opened).toMatch(/^chat:/);
    expect(shared?.record.extra[0]).toMatchObject({ person: "陈晨", candidateId: "local-found1" });
    const nobody = await changeMyChat({
      type: "open",
      conversation: { kind: "candidate", jobId: job.id, candidateId: "local-nobody", name: "没有这个人" },
    });
    expect(nobody?.opened).toBeUndefined();

    const demo = await changeMyChat({
      type: "open",
      conversation: { kind: "candidate", jobId: job.id, candidateId: "candidate-lin", name: "林晓" },
    });
    expect(demo?.opened).toBe(`recommend:candidate-lin:${job.id}`);
    expect(store.chats.get(teamChatScope(job.employerId))?.extra.map((c) => c.id)).toEqual([demo?.opened]);
  });

  it("a business's own record holds at most 100 conversations; a new one past that is refused and said (security review F)", async () => {
    const { boss, job } = await business("crowded");
    const scope = teamChatScope(job.employerId);
    const lin = `recommend:candidate-lin:${job.id}`;
    const others = Array.from({ length: 99 }, (_, i) => ({
      id: `recommend:other${i}:${job.id}`,
      person: "某人",
      title: job.titleZh,
      time: "昨天",
      avatar: "某",
      job: job.id,
    }));
    await signedIn(boss, "employer");
    const open = {
      type: "open",
      conversation: { kind: "candidate", jobId: job.id, candidateId: "candidate-lin", name: "林晓" },
    } as const;
    await store.putChat(scope, { ...EMPTY_CHAT, extra: [...others, { ...others[0], id: lin }] });
    expect((await changeMyChat(open))?.opened).toBe(lin); // one it has opens again
    await store.putChat(scope, {
      ...EMPTY_CHAT,
      extra: [...others, { ...others[0], id: `recommend:other99:${job.id}` }],
    });
    const refused = await changeMyChat(open);
    expect(refused?.opened).toBeUndefined();
    expect(refused?.notice).toBe("你已经有 100 段这样的对话，到上限了，没能发起新的聊天。");
    expect(store.chats.get(scope)?.extra).toHaveLength(100);
  });

  it("a job seeker's chat from before #110 keeps its messages and goes on in the shared conversation", async () => {
    const { shop, boss, job } = await business("before");
    const seekerId = `employer:${shop.id}:${job.id}`;
    await signedIn("before.seeker@example.com");
    const old: ChatRecord = {
      ...addSentMessage(EMPTY_CHAT, seekerId, "以前发的", "2026-10-16T00:00:00.000Z"),
      extra: [{ id: seekerId, person: shop.name, title: job.titleZh, time: "昨天", avatar: "b", job: job.id }],
    };
    await store.putChat(seekerScope("before.seeker@example.com"), old);
    await change({ type: "send", conversationId: seekerId, text: "现在发的" });
    expect((await my())!.added[seekerId].map((m) => m.text)).toEqual(["以前发的", "现在发的"]);

    await signedIn(boss, "employer");
    const seen = (await my())!;
    const id = seen.extra.find((c) => c.job === job.id)!.id;
    expect(seen.added[id].map((m) => m.text)).toEqual(["现在发的"]);
  });

  it("a full shared conversation takes no more messages and tells the sender, in their language", async () => {
    const { shop, boss, job } = await business("full");
    const seekerId = `employer:${shop.id}:${job.id}`;
    await signedIn("full.seeker@example.com");
    await change({ type: "send", conversationId: seekerId, text: "你好" });
    const db = await database();
    const [row] = await db
      .select()
      .from(t.conversations)
      .where(eq(t.conversations.seekerEmail, "full.seeker@example.com"));
    const filler = Array.from({ length: SHARED_MESSAGES_MAX - 2 }, () => ({
      conversationId: row.id,
      from: "employer" as const,
      text: "在",
      sentAt: new Date().toISOString(),
    }));
    const [first, ...rest] = insertsInChunks(db, t.messages, filler);
    await db.batch([first, ...rest]);

    const last = await changeMyChat({ type: "send", conversationId: seekerId, text: "最后一条" });
    expect(last?.notice).toBeUndefined();
    const over = await changeMyChat({ type: "send", conversationId: seekerId, text: "多出来的" });
    expect(over?.notice).toBe(`这段对话里已经有 ${SHARED_MESSAGES_MAX} 条消息，到上限了，这条没有发出。`);
    expect(over?.record.added[seekerId]?.map((m) => m.text)).not.toContain("多出来的");

    await signedIn(boss, "employer");
    cookies.set("zg_lang", "en");
    const id = (await my())!.extra.find((c) => c.job === job.id)!.id;
    expect((await changeMyChat({ type: "send", conversationId: id, text: "还在" }))?.notice).toBe(
      `This conversation already has ${SHARED_MESSAGES_MAX} messages, the most it can hold, so this one wasn't sent.`,
    );
    expect((await my())!.added[id]).toHaveLength(SHARED_MESSAGES_MAX);
  });

  it("a ticket applies a shared change once", async () => {
    const { shop, boss, job } = await business("ticket");
    const seekerId = `employer:${shop.id}:${job.id}`;
    await signedIn("ticket.seeker@example.com");
    await changeMyChat({ type: "open", conversation: { kind: "employer", jobId: job.id } });
    const ticket = { id: "5a0c1f7e-4d1a-4a5e-9f3c-1c2d3e4f5a6b", scope: seekerScope("ticket.seeker@example.com") };
    const send = { type: "send", conversationId: seekerId, text: "只发一次" } as const;
    await changeMyChat(send, ticket);
    await changeMyChat(send, ticket);
    await signedIn(boss, "employer");
    const seen = (await my())!;
    expect(seen.added[seen.extra.find((c) => c.job === job.id)!.id].map((m) => m.text)).toEqual(["只发一次"]);
  });

  it("a job seeker's message that gets there before its open starts the conversation; a closed job's does not", async () => {
    const { shop, boss, job } = await business("early");
    await signedIn("early.seeker@example.com");
    await change({ type: "send", conversationId: `employer:${shop.id}:${job.id}`, text: "先到的消息" });
    await change({ type: "send", conversationId: `employer:${shop.id}:j17`, text: "过期职位" }); // expired
    await change({ type: "send", conversationId: `employer:${shop.id}:j1`, text: "企业和职位对不上" }); // j1 is another business's
    await signedIn(boss, "employer");
    const seen = (await my())!;
    expect(seen.extra.map((c) => c.job)).toEqual([job.id]);
    expect(seen.added[seen.extra[0].id].map((m) => m.text)).toEqual(["先到的消息"]);
  });

  describe("the chat page's read every 10 seconds sends only what changed (#369, ADR 0040)", () => {
    type Changes = Extract<Awaited<ReturnType<typeof myChatChanges>>, { shared: unknown }>;
    type Whole = Extract<Awaited<ReturnType<typeof myChatChanges>>, { record: unknown }>;
    const at = (minute: number) => vi.setSystemTime(new Date(Date.UTC(2026, 9, 25, 2, minute))); // 15:xx in Auckland

    /** One browser's copy, read and kept as chat-client.ts does. */
    function browser() {
      let record: ChatRecord | undefined;
      let sync: { cursor?: Whole["cursor"]; own?: ChatRecord; ownTag?: string } = {};
      return {
        get record() {
          return record!;
        },
        async read(): Promise<Changes | Whole> {
          const since = sync.cursor ? { cursor: sync.cursor, ownTag: sync.ownTag } : null;
          const answer = (await myChatChanges(since))!;
          if ("record" in answer) {
            record = answer.record;
            sync = { ...sync, cursor: answer.cursor };
          } else {
            const own = answer.own ?? sync.own!;
            record = mergeSharedChanges(record!, own, answer.shared);
            sync = { cursor: answer.cursor, own, ownTag: answer.ownTag };
          }
          return answer;
        },
      };
    }

    async function talking(tag: string) {
      vi.useFakeTimers({ toFake: ["Date"] });
      at(0);
      const { shop, boss, job } = await business(tag);
      const seeker = `${tag}.seeker@example.com`;
      const seekerId = `employer:${shop.id}:${job.id}`;
      await signedIn(seeker);
      await changeMyChat({ type: "open", conversation: { kind: "employer", jobId: job.id } });
      await change({ type: "send", conversationId: seekerId, text: "你好，还招人吗？" });
      // Another chat of the job seeker's, with another job, that stays as it is.
      const other = await business(`${tag}2`);
      await changeMyChat({ type: "open", conversation: { kind: "employer", jobId: other.job.id } });
      await change({ type: "send", conversationId: `employer:${other.shop.id}:${other.job.id}`, text: "在吗" });
      await signedIn(boss, "employer");
      const id = (await my())!.extra.find((c) => c.job === job.id)!.id;
      return { boss, seeker, seekerId, id, job };
    }

    it("a new device's first read gets everything, with a cursor; then a quiet chat answers with almost nothing", async () => {
      const { seeker } = await talking("sync1");
      await signedIn(seeker);
      const page = browser();
      at(2);
      const first = (await page.read()) as Whole;
      expect(first.record).toEqual(await my());
      expect(first.cursor).toEqual({ messageId: expect.any(Number), at: expect.any(String) });

      at(5); // past the cursor's time, nothing new
      const second = (await page.read()) as Changes;
      expect(second.shared.part.conversations).toEqual([]);
      expect(second.own).toEqual(EMPTY_CHAT); // the first changes name the own record
      const third = (await page.read()) as Changes;
      expect(third.own).toBeUndefined(); // the browser has it
      expect(third.shared.order).toHaveLength(2);
      expect(JSON.stringify(third).length).toBeLessThan(400);
      expect(page.record).toEqual(await my());
    });

    it("a message in between comes alone, with the business's read; the copy is then what a full read gives", async () => {
      const { boss, seeker, seekerId, id } = await talking("sync2");
      await signedIn(seeker);
      const page = browser();
      at(2);
      await page.read();
      at(5);
      await page.read();

      await signedIn(boss, "employer");
      at(6);
      await change({ type: "read", conversationId: id });
      await change({ type: "send", conversationId: id, text: "还招，明天来面试吧" });
      await signedIn(seeker);
      at(7);
      const changes = (await page.read()) as Changes;
      expect(changes.shared.part.conversations.map((c) => c.id)).toEqual([seekerId]);
      expect(changes.shared.part.added[seekerId].map((m) => m.text)).toEqual(["还招，明天来面试吧"]);
      expect(page.record).toEqual(await my());
      expect(page.record.added[seekerId][0].readAt).toBeTruthy(); // the business read the first one

      at(9);
      expect(((await page.read()) as Changes).shared.part.conversations).toEqual([]);
    });

    it("an exchange answered and the other side's own chats come through too", async () => {
      const { boss, seeker, seekerId, id, job } = await talking("sync3");
      await signedIn(seeker);
      const offer = { title: "联系方式", fields: [{ label: "电话", value: "021 555 0003" }] };
      await change({ type: "request", conversationId: seekerId, kind: "contact", payload: offer });

      await signedIn(boss, "employer");
      const page = browser();
      at(2);
      await page.read();
      at(5);
      await page.read();
      await signedIn(seeker);
      at(6);
      const exchangeId = (await my())!.exchanges[seekerId][0].id;
      await change({ type: "answer", conversationId: seekerId, exchangeId, status: "cancelled" });
      await signedIn(boss, "employer");
      at(7);
      await page.read();
      expect(page.record).toEqual(await my());
      expect(page.record.exchanges[id][0].status).toBe("cancelled");
      expect(page.record.extra.find((c) => c.job === job.id)?.id).toBe(id);
    });

    it("reads everything again for a cursor that is not this database's, or one that is not a cursor", async () => {
      const { seeker } = await talking("sync4");
      await signedIn(seeker);
      for (const since of [
        { cursor: { messageId: Number.MAX_SAFE_INTEGER, at: "2026-10-25T02:00:00.000Z" } },
        { cursor: { messageId: -1, at: "2026-10-25T02:00:00.000Z" } },
        { cursor: { messageId: 1, at: "昨天" } },
        "everything",
      ]) {
        const answer = await myChatChanges(since);
        expect(answer && "record" in answer && answer.record).toEqual(await my());
      }
    });
  });
});
