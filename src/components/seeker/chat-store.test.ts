import { describe, expect, it } from "vitest";
import { chatDemo } from "@/components/seeker/chat-demo";
import {
  EMPTY_CHAT,
  LEGACY_READ_AT,
  addExchangeRequest,
  addSentMessage,
  answerExchange,
  chatView,
  markConversationRead,
  openConversation,
  parseChats,
  type ChatDemo,
} from "@/components/seeker/chat-store";
import { LOCAL_DATA_VERSION, stringifyStoredIdentities } from "@/components/seeker/identity-scope";

const seekerScope = JSON.stringify(["owner@example.com", "seeker", null]);
const employerScope = JSON.stringify(["owner@example.com", "employer", "e1"]);
const seekerDemo = chatDemo(false);
const employerDemo = chatDemo(true);
const at = "2026-10-15T01:00:00.000Z";
const offered = { title: "联系方式", fields: [{ label: "电话", value: "021 555 0001" }] };
const report = {
  id: "r1",
  conversationId: "north-tea",
  targetName: "北岸早茶酒家",
  targetRole: "employer",
  reason: "fraud",
  note: "可疑内容",
  evidence: [],
  createdAt: "2026-10-13",
};
const employerChat = {
  id: "employer:e1:j1",
  person: "川味小馆",
  title: "前厅服务员",
  time: "刚刚",
  avatar: "川",
  job: "j1",
  employerId: "e1",
};

describe("stored chats", () => {
  it("are written with a version and only the user's own records", () => {
    let record = addSentMessage(EMPTY_CHAT, "north-tea", "你好", at);
    record = markConversationRead(record, "north-tea", at);
    const raw = stringifyStoredIdentities({ [seekerScope]: record });
    expect(JSON.parse(raw)).toEqual({ version: LOCAL_DATA_VERSION, identities: { [seekerScope]: record } });
    expect(raw).not.toContain(seekerDemo.messages["north-tea"][0].text);
    expect(parseChats(raw, chatDemo)[seekerScope]).toEqual(record);
  });

  it("show the demo merged with the user's records", () => {
    const record = markConversationRead(addSentMessage(EMPTY_CHAT, "north-tea", "你好", at), "north-tea", at);
    const view = chatView(record, seekerDemo);
    const thread = view.messages["north-tea"];
    expect(thread).toHaveLength(seekerDemo.messages["north-tea"].length + 1);
    expect(thread.at(-1)).toEqual({ from: "me", text: "你好", time: "刚刚", sentAt: at });
    expect(thread.filter((m) => m.from === "them").every((m) => m.readAt === at)).toBe(true);
    expect(view.unread["north-tea"]).toBe(0);
    expect(view.unread["mt-eden"]).toBe(seekerDemo.unread["mt-eden"]);
    expect(chatView(EMPTY_CHAT, seekerDemo).messages).toEqual(seekerDemo.messages);
  });

  it("count a reply that arrived after the conversation was read as unread, until it is read again", () => {
    const later = "2026-10-15T02:00:00.000Z";
    const reply = { from: "them" as const, text: "收到", time: "刚刚", sentAt: later };
    let record = markConversationRead(EMPTY_CHAT, "north-tea", at);
    record = { ...record, added: { "north-tea": [reply] } };
    expect(chatView(record, seekerDemo).unread["north-tea"]).toBe(1);
    expect(chatView(record, seekerDemo).messages["north-tea"].at(-1)?.readAt).toBeUndefined();
    record = markConversationRead(record, "north-tea", "2026-10-15T03:00:00.000Z");
    expect(chatView(record, seekerDemo).unread["north-tea"]).toBe(0);
  });

  it("keep the user's messages when the demo data changes, even if a demo conversation is renamed", () => {
    const record = openConversation(addSentMessage(EMPTY_CHAT, "north-tea", "还在吗", at), employerChat);
    const raw = stringifyStoredIdentities({ [seekerScope]: record });
    const changed: ChatDemo = {
      ...seekerDemo,
      conversations: seekerDemo.conversations.map((c) => (c.id === "north-tea" ? { ...c, id: "north-tea-2" } : c)),
      messages: { "north-tea-2": [{ from: "them", text: "新的演示开场白", time: "09:00" }] },
    };
    const parsed = parseChats(raw, () => changed)[seekerScope];
    expect(parsed).toEqual(record);
    expect(chatView(parsed, changed).conversations[0].id).toBe(employerChat.id);
    // The old conversation is no longer shown, but the message is still stored for when it comes back.
    expect(parsed.added["north-tea"]).toEqual([{ from: "me", text: "还在吗", time: "刚刚", sentAt: at }]);
  });

  it("drop a bad part on its own, never the whole record", () => {
    const raw = JSON.stringify({
      version: LOCAL_DATA_VERSION,
      identities: {
        [seekerScope]: {
          added: {
            "north-tea": [
              { from: "me", text: "留下", time: "刚刚" },
              { from: "x", text: 1 },
            ],
            bad: "x",
          },
          readAt: { "north-tea": at, "mt-eden": "yesterday" },
          extra: [employerChat, { ...employerChat, employerId: 1 }],
          exchanges: { "north-tea": [{ id: "x", kind: "contact", status: "accepted" }] },
          reports: [report, { id: 1 }],
        },
      },
    });
    expect(parseChats(raw, chatDemo)[seekerScope]).toEqual({
      added: { "north-tea": [{ from: "me", text: "留下", time: "刚刚" }] },
      readAt: { "north-tea": at },
      extra: [employerChat],
      exchanges: { "north-tea": [] },
      reports: [report],
    });
    const partial = JSON.stringify({ version: LOCAL_DATA_VERSION, identities: { [seekerScope]: { readAt: {} } } });
    expect(parseChats(partial, chatDemo)[seekerScope]).toEqual(EMPTY_CHAT);
  });

  it("read as empty when written by a newer version, or not readable at all", () => {
    for (const raw of [
      JSON.stringify({ version: LOCAL_DATA_VERSION + 1, identities: { [seekerScope]: EMPTY_CHAT } }),
      "bad json",
      "[]",
      "null",
    ])
      expect(parseChats(raw, chatDemo)).toEqual({});
  });
});

describe("chats from before versioning", () => {
  const legacySeeker = {
    messages: {
      ...seekerDemo.messages,
      "north-tea": [
        ...seekerDemo.messages["north-tea"].map((m) => (m.from === "them" ? { ...m, readAt: at } : m)),
        { from: "me", text: "我下午有空", time: "刚刚", sentAt: at },
      ],
      [employerChat.id]: [{ from: "me", text: "想应聘", time: "刚刚" }],
    },
    unread: { "north-tea": 0, "mt-eden": 0, "clean-home": 0, [employerChat.id]: 0 },
    extra: [employerChat],
    exchanges: {
      ...seekerDemo.exchanges,
      "mt-eden": seekerDemo.exchanges["mt-eden"].map((x) => ({
        ...x,
        status: "accepted",
        response: offered,
        respondedAt: at,
      })),
    },
    reports: [report],
  };

  it("keep what the user did: own messages, reads, opened chats, answered exchanges and reports", () => {
    const record = parseChats(JSON.stringify({ [seekerScope]: legacySeeker }), chatDemo)[seekerScope];
    expect(record).toEqual({
      added: {
        "north-tea": [{ from: "me", text: "我下午有空", time: "刚刚", sentAt: at }],
        [employerChat.id]: [{ from: "me", text: "想应聘", time: "刚刚" }],
      },
      readAt: { "north-tea": at, "mt-eden": LEGACY_READ_AT },
      extra: [employerChat],
      exchanges: { "mt-eden": legacySeeker.exchanges["mt-eden"] },
      reports: [report],
    });
    // Shown as before.
    const view = chatView(record, seekerDemo);
    expect(view.messages["north-tea"]).toEqual(legacySeeker.messages["north-tea"]);
    expect(view.unread).toEqual(legacySeeker.unread);
    expect(view.exchanges["mt-eden"][0].status).toBe("accepted");
    expect(view.exchanges["north-tea"]).toEqual(seekerDemo.exchanges["north-tea"]);
  });

  it("move a bare-email record to the account's job-seeker identity, unless that identity has its own", () => {
    const raw = JSON.stringify({ "Owner@Example.com": legacySeeker });
    expect(Object.keys(parseChats(raw, chatDemo))).toEqual([seekerScope]);
    const both = JSON.stringify({ "owner@example.com": legacySeeker, [seekerScope]: { messages: {}, unread: {} } });
    expect(parseChats(both, chatDemo)[seekerScope]).toEqual(EMPTY_CHAT);
  });

  it("use the employer demo for an employer identity", () => {
    const legacy = {
      messages: {
        ...employerDemo.messages,
        "candidate-lin": [...employerDemo.messages["candidate-lin"], { from: "me", text: "明天见", time: "刚刚" }],
      },
      unread: { "candidate-lin": 1, "candidate-chen": 0, "candidate-wang": 0 },
    };
    const record = parseChats(JSON.stringify({ [employerScope]: legacy }), chatDemo)[employerScope];
    expect(record.added).toEqual({ "candidate-lin": [{ from: "me", text: "明天见", time: "刚刚" }] });
    expect(record.readAt).toEqual({ "candidate-chen": LEGACY_READ_AT });
  });

  it("keep sent messages when the stored thread no longer starts with the demo", () => {
    const legacy = {
      messages: {
        "north-tea": [
          { from: "them", text: "旧开场白", time: "10:00" },
          { from: "me", text: "在", time: "刚刚" },
        ],
      },
      unread: { "north-tea": 2 },
    };
    expect(parseChats(JSON.stringify({ [seekerScope]: legacy }), chatDemo)[seekerScope].added).toEqual({
      "north-tea": [{ from: "me", text: "在", time: "刚刚" }],
    });
  });
});

describe("exchanges", () => {
  it("store a new request, and an answer to a demo request under the demo's id", () => {
    let record = addExchangeRequest(EMPTY_CHAT, seekerDemo, "mt-eden", "contact", offered, "mine");
    expect(record.exchanges["mt-eden"].map((x) => x.id)).toEqual(["mine"]);
    // A second pending request of the same kind is refused.
    expect(addExchangeRequest(record, seekerDemo, "mt-eden", "contact", offered, "again")).toBe(record);

    const demoId = seekerDemo.exchanges["north-tea"][0].id;
    record = answerExchange(record, seekerDemo, "north-tea", demoId, "accepted", offered);
    expect(record.exchanges["north-tea"]).toHaveLength(1);
    const view = chatView(record, seekerDemo);
    expect(view.exchanges["north-tea"]).toHaveLength(1);
    expect(view.exchanges["north-tea"][0]).toMatchObject({ id: demoId, status: "accepted", response: offered });
    expect(view.exchanges["mt-eden"].map((x) => x.id)).toEqual([seekerDemo.exchanges["mt-eden"][0].id, "mine"]);
    expect(view.exchanges["clean-home"]).toEqual([]);
    expect(answerExchange(record, seekerDemo, "north-tea", "nope", "rejected")).toBe(record);
  });
});
