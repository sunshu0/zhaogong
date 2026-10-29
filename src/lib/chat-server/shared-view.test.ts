import { describe, expect, it } from "vitest";
import {
  chatTime,
  mergeSharedChanges,
  parseSharedId,
  sharedChanges,
  sharedConversationId,
  sharedPart,
  withShared,
  type SharedConversation,
  type SharedExchange,
} from "@/lib/chat-server/shared-view";
import type { ChatRecord } from "@/components/seeker/chat-store";
import { parseResumeDoc } from "@/components/seeker/resume-doc";

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
    interview: false,
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

  it("says yesterday and the date in English too", () => {
    expect(chatTime("2026-10-16T22:05:00.000Z", now, "en")).toBe("11:05");
    expect(chatTime("2026-10-16T05:00:00.000Z", now, "en")).toBe("Yesterday");
    expect(chatTime("2026-10-02T05:00:00.000Z", now, "en")).toBe("2 October");
  });
});

describe("sharedPart", () => {
  const messages = [
    { id: 1, from: "seeker" as const, text: "你好", sentAt: "2026-10-17T00:01:00.000Z", byName: null },
    { id: 2, from: "employer" as const, text: "你好，明天来吧", sentAt: "2026-10-17T00:02:00.000Z", byName: "王经理" },
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

  it("shows a sent 中英文简历 as a card in each reader's words, without the page itself (#379)", () => {
    const resume = parseResumeDoc(
      { zh: { name: "林晓" }, contact: { wechat: "linxiao", email: "lin@example.com" } },
      { withEmail: true },
    )!;
    const sent = row({
      messages: [{ id: 7, from: "seeker", text: "[简历]", sentAt: "2026-10-17T00:01:00.000Z", byName: null, resume }],
    });
    const [mine] = sharedPart([sent], "seeker", now).added["employer:e1:j1"];
    expect(mine).toMatchObject({ from: "me", text: "[简历] 林晓" });
    expect(mine.resume).toEqual({ id: 7, name: "林晓", contact: ["wechat", "email"] });
    const [theirs] = sharedPart([sent], "employer", now, "en").added["chat:c0ffee00-1111"];
    expect(theirs).toMatchObject({ from: "them", text: "[CV] 林晓" });
    expect(JSON.stringify(theirs)).not.toContain("linxiao");
  });

  it("a message the other side has not read yet has no read time", () => {
    const part = sharedPart([row({ messages, seekerReadAt: "2026-10-17T00:01:30.000Z" })], "employer", now);
    expect(part.added["chat:c0ffee00-1111"][1].readAt).toBeUndefined();
  });

  it("shows a chat the other side opened only once something is said in it", () => {
    expect(sharedPart([row()], "seeker", now).conversations).toHaveLength(1);
    expect(sharedPart([row()], "employer", now).conversations).toEqual([]);
    const said = row({
      messages: [{ id: 1, from: "seeker", text: "你好", sentAt: "2026-10-17T00:01:00.000Z", byName: null }],
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
      [row({ messages: [{ id: 1, from: "seeker", text: "新的", sentAt: "2026-10-17T00:01:00.000Z", byName: null }] })],
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

describe("changes since a read (#369, ADR 0040)", () => {
  const hi = { id: 1, from: "seeker" as const, text: "你好", sentAt: "2026-10-17T00:01:00.000Z", byName: null };
  const answer = {
    id: 5,
    from: "employer" as const,
    text: "明天来吧",
    sentAt: "2026-10-17T00:40:00.000Z",
    byName: "王经理",
  };
  const a = row({ messages: [hi] });
  const b = row({
    id: "c0ffee00-2222",
    jobId: "j2",
    messages: [{ ...hi, id: 2 }],
    updatedAt: "2026-10-17T00:20:00.000Z",
  });
  const full = (rows: SharedConversation[], side: "seeker" | "employer", own = empty) =>
    withShared(own, sharedPart(rows, side, now));
  /** The browser's copy after a full read of `before`, with the changes that lead to `after` applied. */
  const merged = (
    before: SharedConversation[],
    after: SharedConversation[],
    changed: SharedConversation[],
    side: "seeker" | "employer",
    own = empty,
  ) => mergeSharedChanges(full(before, side, own), own, sharedChanges(after, changed, side, now));

  it("a new message and the other side's read: only those come, and the copy is what a full read gives", () => {
    const read = { employerReadAt: "2026-10-17T00:40:00.000Z", updatedAt: "2026-10-17T00:40:00.000Z" };
    const after = [{ ...a, ...read, messages: [hi, answer] }, b];
    const changes = sharedChanges(after, [{ ...a, ...read, messages: [answer] }], "seeker", now);
    expect(changes.order).toEqual(["employer:e1:j1", "employer:e1:j2"]);
    expect(changes.part.added).toEqual({ "employer:e1:j1": [expect.objectContaining({ text: "明天来吧" })] });
    expect(changes.theirReadAt).toEqual({ "employer:e1:j1": read.employerReadAt });
    const copy = mergeSharedChanges(full([a, b], "seeker"), empty, changes);
    expect(copy).toEqual(full(after, "seeker"));
    expect(copy.added["employer:e1:j1"][0].readAt).toBe(read.employerReadAt);
  });

  it("with nothing changed, the copy stays as it is", () => {
    expect(merged([a, b], [a, b], [], "seeker")).toEqual(full([a, b], "seeker"));
  });

  it("drops a conversation that is gone, and moves the one written to first", () => {
    expect(merged([a, b], [b], [], "seeker")).toEqual(full([b], "seeker"));
    const later = { ...b, updatedAt: "2026-10-17T00:50:00.000Z", messages: [{ ...answer, id: 6 }] };
    const after = [a, { ...later, messages: [...b.messages, ...later.messages] }];
    expect(merged([a, b], after, [later], "seeker").extra.map((c) => c.id)).toEqual([
      "employer:e1:j2",
      "employer:e1:j1",
    ]);
    expect(merged([a, b], after, [later], "seeker")).toEqual(full(after, "seeker"));
  });

  it("shows a chat the job seeker opened only once something is said in it, as a full read does", () => {
    const opened = row({ id: "c0ffee00-3333", jobId: "j3", updatedAt: "2026-10-17T00:30:00.000Z" });
    const seen = { ...opened, seekerReadAt: "2026-10-17T00:45:00.000Z" };
    expect(merged([a], [a, seen], [seen], "employer")).toEqual(full([a, seen], "employer"));
    expect(merged([a], [a, seen], [seen], "employer").extra).toHaveLength(1);
    const said = { ...seen, messages: [{ ...hi, id: 9 }] };
    expect(merged([a, seen], [a, said], [said], "employer")).toEqual(full([a, said], "employer"));
    // A quiet change to one the browser has (it had messages before) still comes through.
    const readAgain = { ...a, seekerReadAt: "2026-10-17T00:55:00.000Z", messages: [] };
    expect(merged([a], [{ ...readAgain, messages: [hi] }], [readAgain], "employer")).toEqual(
      full([{ ...readAgain, messages: [hi] }], "employer"),
    );
  });

  it("keeps the messages from before #110 ahead of the shared ones, and the own record's chats after them", () => {
    const own: ChatRecord = {
      ...empty,
      added: { "employer:e1:j1": [{ from: "me", text: "以前发的", time: "昨天" }] },
      extra: [{ id: "candidate-lin", person: "林晓", title: "", time: "", avatar: "林", job: null }],
    };
    const after = [{ ...a, messages: [hi, answer] }, b];
    const copy = merged([a, b], after, [{ ...a, messages: [answer] }], "seeker", own);
    expect(copy).toEqual(full(after, "seeker", own));
    expect(copy.added["employer:e1:j1"].map((m) => m.text)).toEqual(["以前发的", "你好", "明天来吧"]);
  });
});

describe("a business under a ban (ADR 0044)", () => {
  const now = Date.parse("2026-10-17T01:00:00.000Z");
  const said = {
    messages: [{ id: 1, from: "seeker" as const, text: "你好", sentAt: "2026-10-17T00:20:00.000Z", byName: null }],
  };
  const a = row({ ...said });
  const b = row({ ...said, id: "c0ffee00-2222", employerId: "e2", jobId: "j2", updatedAt: "2026-10-17T00:20:00.000Z" });
  const banned = new Set(["e1"]);

  it("pauses the job seeker's chats with it, and nothing on the business's side", () => {
    const seeker = sharedPart([a, b], "seeker", now, "zh", banned).conversations;
    expect(seeker.map((c) => [c.id, c.paused])).toEqual([
      ["employer:e1:j1", true],
      ["employer:e2:j2", undefined],
    ]);
    expect(sharedPart([a, b], "employer", now, "zh", banned).conversations.every((c) => !c.paused)).toBe(true);
  });

  it("reaches a kept copy whose chat did not change, when the ban starts and when it ends", () => {
    const kept = withShared(empty, sharedPart([a, b], "seeker", now));
    const started = mergeSharedChanges(kept, empty, sharedChanges([a, b], [], "seeker", now, "zh", banned));
    expect(started).toEqual(withShared(empty, sharedPart([a, b], "seeker", now, "zh", banned)));
    const ended = mergeSharedChanges(started, empty, sharedChanges([a, b], [], "seeker", now));
    expect(ended).toEqual(kept);
  });
});

describe("已约面 and pins in the chat list (C7, ADR 0053)", () => {
  const said = {
    messages: [{ id: 1, from: "seeker" as const, text: "你好", sentAt: "2026-10-17T00:20:00.000Z", byName: null }],
  };
  const a = row({ ...said });
  const b = row({ ...said, id: "c0ffee00-2222", jobId: "j2", updatedAt: "2026-10-17T00:20:00.000Z" });
  const invited = { ...a, interview: true };

  it("marks a conversation with an interview invitation in play, for both sides", () => {
    for (const side of ["seeker", "employer"] as const)
      expect(sharedPart([invited, b], side, now).conversations.map((c) => c.interview)).toEqual([true, undefined]);
  });

  it("reaches a kept copy whose chat did not change, when the invitation is sent and when it is called off", () => {
    const kept = withShared(empty, sharedPart([a, b], "employer", now));
    const sent = mergeSharedChanges(kept, empty, sharedChanges([invited, b], [], "employer", now));
    expect(sent).toEqual(withShared(empty, sharedPart([invited, b], "employer", now)));
    const off = mergeSharedChanges(sent, empty, sharedChanges([a, b], [], "employer", now));
    expect(off).toEqual(kept);
  });

  it("keeps the own record's pins through a full read and a read of changes", () => {
    const own: ChatRecord = { ...empty, pinned: { "employer:e1:j2": "2026-10-17T00:50:00.000Z" } };
    const full = withShared(own, sharedPart([a, b], "seeker", now));
    expect(full.pinned).toEqual(own.pinned);
    expect(mergeSharedChanges(full, own, sharedChanges([a, b], [], "seeker", now)).pinned).toEqual(own.pinned);
  });
});
