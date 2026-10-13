import { expect, it } from "vitest";
import { conversationProfileHref, parseChats } from "@/components/seeker/chat-client";

const scope = JSON.stringify(["owner@example.com", "employer", "e1"]);
const seed = {
  messages: { "candidate-lin": [], "candidate-chen": [], "candidate-wang": [] },
  unread: { "candidate-lin": 0, "candidate-chen": 0, "candidate-wang": 0 },
};

it("links static and saved recommendation chats to the counterpart's profile", () => {
  const base = { id: "candidate-lin", person: "林晓", title: "服务员", time: "昨天", avatar: "林", job: null };
  expect(conversationProfileHref(base, true)).toBe("/candidates/candidate-lin");
  expect(conversationProfileHref({ ...base, id: "recommend:local-demo:j1" }, true)).toBe("/candidates/local-demo");
  expect(conversationProfileHref({ ...base, id: "recommend:old:j1", candidateId: "local-new" }, true)).toBe(
    "/candidates/local-new",
  );
  expect(conversationProfileHref({ ...base, employerId: "e5" }, false)).toBe("/employers/e5");
  expect(conversationProfileHref(base, false)).toBeUndefined();
});

it("reads legacy chats and persists recommendation metadata and messages", () => {
  expect(parseChats(JSON.stringify({ [scope]: seed }))[scope]).toEqual(seed);
  const id = "recommend:candidate-zhao:j3";
  const state = {
    messages: { ...seed.messages, [id]: [{ from: "me", text: "你好", time: "刚刚" }] },
    unread: { ...seed.unread, [id]: 0 },
    extra: [{ id, person: "赵晨", title: "点心师傅", job: "j3", time: "刚刚", avatar: "赵" }],
  };
  expect(parseChats(JSON.stringify({ [scope]: state }))[scope]).toEqual(state);
  state.extra[0].job = null as unknown as string;
  expect(parseChats(JSON.stringify({ [scope]: state }))).toEqual({});
});

it("keeps consent and reports alongside legacy chats and rejects malformed consent", () => {
  const offered = { title: "联系方式", fields: [{ label: "电话", value: "021 555 0001" }] };
  const exchange = { id: "x1", kind: "contact", from: "them", status: "pending", offered, createdAt: "2026-10-13" };
  const report = {
    id: "r1",
    conversationId: "candidate-lin",
    targetName: "林晓",
    targetRole: "seeker",
    reason: "fraud",
    note: "可疑内容",
    evidence: [],
    createdAt: "2026-10-13",
  };
  const state = { ...seed, exchanges: { "candidate-lin": [exchange], foreign: [exchange] }, reports: [report] };
  const parsed = parseChats(JSON.stringify({ [scope]: state }))[scope];
  expect(parsed.exchanges).toEqual({ "candidate-lin": [exchange] });
  expect(parsed.reports).toEqual([report]);
  const invalid = parseChats(
    JSON.stringify({ [scope]: { ...seed, exchanges: { "candidate-lin": [{ ...exchange, status: "accepted" }] } } }),
  )[scope];
  expect(invalid.messages).toEqual(seed.messages);
  expect(invalid.exchanges?.["candidate-lin"]).toEqual([]);
});

it("preserves employer conversations for seekers without mixing role state", () => {
  const seeker = JSON.stringify(["owner@example.com", "seeker", null]);
  const id = "employer:e1:j1";
  const conversation = {
    id,
    person: "川味小馆",
    title: "前厅服务员",
    time: "刚刚",
    avatar: "川",
    job: "j1",
    employerId: "e1",
  };
  const state = {
    messages: {
      "north-tea": [],
      "mt-eden": [],
      "clean-home": [],
      [id]: [{ from: "me", text: "想应聘", time: "刚刚" }],
    },
    unread: { "north-tea": 0, "mt-eden": 0, "clean-home": 0, [id]: 0 },
    extra: [conversation],
  };
  const result = parseChats(JSON.stringify({ [seeker]: state, [scope]: seed }));
  expect(result[seeker]).toEqual(state);
  expect(result[scope]).toEqual(seed);
  expect(parseChats(JSON.stringify({ [seeker]: { ...state, extra: [{ ...conversation, employerId: 1 }] } }))).toEqual(
    {},
  );
});

it("persists receipt timestamps and drops malformed optional metadata without losing old messages", () => {
  const message = {
    from: "me",
    text: "新消息",
    time: "刚刚",
    sentAt: "2026-10-13T00:00:00Z",
    readAt: "2026-10-13T00:01:00Z",
  };
  const state = { ...seed, messages: { ...seed.messages, "candidate-lin": [message] } };
  expect(parseChats(JSON.stringify({ [scope]: state }))[scope].messages["candidate-lin"]).toEqual([message]);
  const invalid = {
    ...state,
    messages: { ...seed.messages, "candidate-lin": [{ ...message, sentAt: "bad", readAt: true }] },
  };
  expect(parseChats(JSON.stringify({ [scope]: invalid }))[scope].messages["candidate-lin"]).toEqual([
    { from: "me", text: "新消息", time: "刚刚" },
  ]);
});
