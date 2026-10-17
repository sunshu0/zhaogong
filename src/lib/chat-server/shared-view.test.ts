import { describe, expect, it } from "vitest";
import {
  chatTime,
  parseSharedId,
  sharedConversationId,
  sharedPart,
  withShared,
  type SharedConversation,
  type SharedExchange,
} from "@/lib/chat-server/shared-view";
import type { ChatRecord } from "@/components/seeker/chat-store";

const now = Date.parse("2026-10-17T01:00:00.000Z"); // 14:00 in Auckland
const OFFER = { title: "联系方式", fields: [{ label: "电话", value: "021 000 000" }] };
const ANSWER = { title: "联系方式", fields: [{ label: "微信", value: "xiaowang" }] };

function row(over: Partial<SharedConversation> = {}): SharedConversation {
  return {
    id: "c0ffee00-1111",
    employerId: "e1",
    employerName: "川味小馆",
    jobId: "j1",
    jobTitle: "前厅服务员",
    startedBy: "seeker",
    seekerName: "小王",
    seekerReadAt: null,
    employerReadAt: null,
    updatedAt: "2026-10-17T00:30:00.000Z",
    messages: [],
    exchanges: [],
    ...over,
  };
}

function exchange(over: Partial<SharedExchange> = {}): SharedExchange {
  return {
    id: "x1",
    kind: "contact",
    requestedBy: "employer",
    status: "pending",
    offered: OFFER,
    response: null,
    createdAt: "2026-10-17T00:10:00.000Z",
    respondedAt: null,
    ...over,
  };
}

const empty: ChatRecord = { added: {}, readAt: {}, extra: [], exchanges: {}, reports: [] };

describe("shared conversation ids (#110)", () => {
  it("the job seeker keeps the id the browser makes; the business sees chat:<id>", () => {
    expect(sharedConversationId(row(), "seeker")).toBe("employer:e1:j1");
    expect(sharedConversationId(row(), "employer")).toBe("chat:c0ffee00-1111");
    expect(parseSharedId("employer:e1:j1", "seeker")).toEqual({ employerId: "e1", jobId: "j1" });
    expect(parseSharedId("chat:c0ffee00-1111", "employer")).toEqual({ rowId: "c0ffee00-1111" });
  });

  it("names nothing for the other side's ids, demo ids or junk", () => {
    expect(parseSharedId("chat:c0ffee00-1111", "seeker")).toBeUndefined();
    expect(parseSharedId("employer:e1:j1", "employer")).toBeUndefined();
    expect(parseSharedId("employer:e1", "seeker")).toBeUndefined();
    expect(parseSharedId("employer:e1:j1:x", "seeker")).toBeUndefined();
    expect(parseSharedId("chat:short", "employer")).toBeUndefined();
    expect(parseSharedId("chat:../../etc", "employer")).toBeUndefined();
    expect(parseSharedId("north-tea", "seeker")).toBeUndefined();
    expect(parseSharedId(42, "seeker")).toBeUndefined();
  });
});

describe("chatTime", () => {
  it("is the time today, 昨天, or the date, in Auckland", () => {
    expect(chatTime("2026-10-16T22:05:00.000Z", now)).toBe("11:05");
    expect(chatTime("2026-10-16T05:00:00.000Z", now)).toBe("昨天");
    expect(chatTime("2026-10-02T05:00:00.000Z", now)).toBe("10月2日");
  });
});

describe("sharedPart", () => {
  const messages = [
    { from: "seeker" as const, text: "你好", sentAt: "2026-10-17T00:01:00.000Z", byName: null },
    { from: "employer" as const, text: "你好，明天来吧", sentAt: "2026-10-17T00:02:00.000Z", byName: "王经理" },
  ];

  it("each side sees the other's name, its own messages as me, and when the other read them", () => {
    const shared = row({
      messages,
      seekerReadAt: "2026-10-17T00:01:00.000Z",
      employerReadAt: "2026-10-17T00:02:00.000Z",
    });
    const seeker = sharedPart([shared], "seeker", now);
    expect(seeker.conversations).toEqual([
      {
        id: "employer:e1:j1",
        person: "川味小馆",
        title: "前厅服务员",
        time: "13:30",
        avatar: "川",
        job: "j1",
        employerId: "e1",
      },
    ]);
    expect(seeker.added["employer:e1:j1"]).toEqual([
      { from: "me", text: "你好", time: "13:01", sentAt: messages[0].sentAt, readAt: "2026-10-17T00:02:00.000Z" },
      { from: "them", text: "你好，明天来吧", time: "13:02", sentAt: messages[1].sentAt, by: "王经理" },
    ]);
    expect(seeker.readAt).toEqual({ "employer:e1:j1": "2026-10-17T00:01:00.000Z" });

    const employer = sharedPart([shared], "employer", now);
    expect(employer.conversations[0]).toMatchObject({ id: "chat:c0ffee00-1111", person: "小王", avatar: "小" });
    expect(employer.conversations[0].employerId).toBeUndefined();
    expect(employer.added["chat:c0ffee00-1111"]).toEqual([
      { from: "them", text: "你好", time: "13:01", sentAt: messages[0].sentAt },
      { from: "me", text: "你好，明天来吧", time: "13:02", sentAt: messages[1].sentAt, by: "王经理" },
    ]);
  });

  it("a message the other side has not read yet has no read time", () => {
    const part = sharedPart([row({ messages, seekerReadAt: "2026-10-17T00:01:30.000Z" })], "employer", now);
    expect(part.added["chat:c0ffee00-1111"][1].readAt).toBeUndefined();
  });

  it("shows a chat the other side opened only once something is said in it", () => {
    expect(sharedPart([row()], "seeker", now).conversations).toHaveLength(1);
    expect(sharedPart([row()], "employer", now).conversations).toEqual([]);
    const said = row({
      messages: [{ from: "seeker", text: "你好", sentAt: "2026-10-17T00:01:00.000Z", byName: null }],
    });
    expect(sharedPart([said], "employer", now).conversations).toHaveLength(1);
    expect(
      sharedPart([row({ exchanges: [exchange({ requestedBy: "seeker" })] })], "employer", now).added,
    ).toHaveProperty(["chat:c0ffee00-1111"]);
  });

  it("gives the business the job seeker's 推荐人才 card", () => {
    const part = sharedPart([row({ candidateId: "local-abc", startedBy: "employer" })], "employer", now);
    expect(part.conversations[0].candidateId).toBe("local-abc");
    expect(sharedPart([row({ candidateId: "local-abc" })], "seeker", now).conversations[0].candidateId).toBeUndefined();
  });

  it("lists the newest conversation first", () => {
    const part = sharedPart(
      [row(), row({ id: "c0ffee00-2222", jobId: "j2", updatedAt: "2026-10-17T00:50:00.000Z" })],
      "seeker",
      now,
    );
    expect(part.conversations.map((c) => c.id)).toEqual(["employer:e1:j2", "employer:e1:j1"]);
  });

  it("keeps back what R-12 does not let a side see, but shows the exchange happened", () => {
    const withdrawn = exchange({ status: "cancelled", respondedAt: "2026-10-17T00:20:00.000Z" });
    const turnedDown = exchange({ id: "x2", requestedBy: "seeker", status: "rejected" });
    const accepted = exchange({ id: "x3", status: "accepted", response: ANSWER });
    const shared = row({ exchanges: [withdrawn, turnedDown, accepted] });

    const [mine, theirs, done] = sharedPart([shared], "seeker", now).exchanges["employer:e1:j1"];
    expect(mine).toMatchObject({ id: "x1", from: "them", status: "cancelled" });
    expect(mine.offered).not.toEqual(OFFER);
    expect(theirs).toMatchObject({ id: "x2", from: "me", status: "rejected", offered: OFFER });
    expect(done).toMatchObject({ from: "them", offered: OFFER, response: ANSWER });

    const [asked] = sharedPart([shared], "employer", now).exchanges["chat:c0ffee00-1111"];
    expect(asked).toMatchObject({ from: "me", status: "cancelled", offered: OFFER });
  });
});

describe("withShared", () => {
  it("puts the shared conversations first and keeps what came before #110 ahead of the shared messages", () => {
    const own: ChatRecord = {
      ...empty,
      added: { "employer:e1:j1": [{ from: "me", text: "以前发的", time: "昨天" }], "north-tea": [] },
      extra: [
        { id: "employer:e1:j1", person: "旧", title: "旧", time: "昨天", avatar: "旧", job: "j1", employerId: "e1" },
        { id: "candidate-lin", person: "林晓", title: "", time: "", avatar: "林", job: null },
      ],
      readAt: { "candidate-lin": "2026-10-16T00:00:00.000Z" },
    };
    const part = sharedPart(
      [row({ messages: [{ from: "seeker", text: "新的", sentAt: "2026-10-17T00:01:00.000Z", byName: null }] })],
      "seeker",
      now,
    );
    const merged = withShared(own, part);
    expect(merged.extra.map((c) => c.id)).toEqual(["employer:e1:j1", "candidate-lin"]);
    expect(merged.extra[0].person).toBe("川味小馆");
    expect(merged.added["employer:e1:j1"].map((m) => m.text)).toEqual(["以前发的", "新的"]);
    expect(merged.added["north-tea"]).toEqual([]);
    expect(merged.readAt["candidate-lin"]).toBe("2026-10-16T00:00:00.000Z");
  });

  it("is the own record when nothing is shared", () => {
    expect(withShared(empty, sharedPart([], "seeker", now))).toEqual(empty);
  });
});
