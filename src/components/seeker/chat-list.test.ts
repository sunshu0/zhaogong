import { describe, expect, it } from "vitest";
import { chatGroup, chatList } from "@/components/seeker/chat-list";
import type { Conversation, Message } from "@/components/seeker/chat-store";
import type { Exchange } from "@/lib/chat-consent";

const conversation = (id: string, over: Partial<Conversation> = {}): Conversation => ({
  id,
  person: id,
  title: "前厅服务员",
  time: "10:42",
  avatar: id.slice(0, 1),
  job: "j1",
  ...over,
});
const from = (who: "me" | "them"): Message => ({ from: who, text: "你好", time: "10:42" });
const offered = { title: "联系方式", fields: [{ label: "电话", value: "021 000 000" }] };
const exchange = (who: "me" | "them", status: Exchange["status"] = "pending"): Exchange => ({
  id: `x-${who}-${status}`,
  kind: "contact",
  from: who,
  status,
  offered,
  createdAt: "2026-10-30T01:00:00.000Z",
});

describe("chat list groups (C7, ADR 0053)", () => {
  it("新招呼: the other side said something and this side has not answered at all", () => {
    expect(chatGroup(conversation("a"), [from("them")], [])).toBe("new");
    expect(chatGroup(conversation("a"), [], [exchange("them")])).toBe("new");
    // Their request withdrawn before an answer is still not answered.
    expect(chatGroup(conversation("a"), [from("them")], [exchange("them", "cancelled")])).toBe("new");
  });

  it("沟通中: both have spoken, this side answered an exchange, or this side spoke first", () => {
    expect(chatGroup(conversation("a"), [from("them"), from("me")], [])).toBe("talking");
    expect(chatGroup(conversation("a"), [from("them")], [exchange("them", "accepted")])).toBe("talking");
    expect(chatGroup(conversation("a"), [from("them")], [exchange("them", "rejected")])).toBe("talking");
    expect(chatGroup(conversation("a"), [from("me")], [])).toBe("talking");
    expect(chatGroup(conversation("a"), [], [exchange("me")])).toBe("talking");
    expect(chatGroup(conversation("a"), [], [])).toBe("talking");
  });

  it("已约面 comes first, whatever was said", () => {
    expect(chatGroup(conversation("a", { interview: true }), [from("them")], [])).toBe("interview");
    expect(chatGroup(conversation("a", { interview: true }), [from("them"), from("me")], [])).toBe("interview");
  });

  const view = {
    conversations: [
      conversation("newest"),
      conversation("hello"),
      conversation("invited", { interview: true }),
      conversation("oldest"),
    ],
    messages: {
      newest: [from("me")],
      hello: [from("them")],
      invited: [from("them")],
      oldest: [from("them"), from("me")],
    },
    exchanges: {},
    pinned: { oldest: "2026-10-30T01:00:00.000Z", hello: "2026-10-30T02:00:00.000Z" },
  };

  it("puts pinned conversations first, the latest pinned at the top, the rest in the order they came", () => {
    expect(chatList(view, "all").rows.map((c) => c.id)).toEqual(["hello", "oldest", "newest", "invited"]);
    expect(chatList({ ...view, pinned: {} }, "all").rows.map((c) => c.id)).toEqual([
      "newest",
      "hello",
      "invited",
      "oldest",
    ]);
  });

  it("shows one group at a time, pins first there too, and counts every group", () => {
    expect(chatList(view, "talking").rows.map((c) => c.id)).toEqual(["oldest", "newest"]);
    expect(chatList(view, "new").rows.map((c) => c.id)).toEqual(["hello"]);
    expect(chatList(view, "interview").rows.map((c) => c.id)).toEqual(["invited"]);
    expect(chatList(view, "new").counts).toEqual({ all: 4, new: 1, talking: 2, interview: 1 });
  });
});
