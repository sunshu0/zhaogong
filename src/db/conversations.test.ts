import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  addSharedExchange,
  addSharedMessage,
  answerSharedExchange,
  findSharedConversation,
  listSharedChanges,
  listSharedConversations,
  markSharedRead,
  openSharedConversation,
  SHARED_MESSAGES_MAX,
} from "@/db/conversations";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { insertsInChunks } from "@/db/write-if";
import { saveSeekerProfile } from "@/db/seeker-profiles";
import { ensureAccount } from "@/lib/data";
import { answerInterview, cancelInterview, inviteToInterview } from "@/db/interviews";

const t0 = new Date("2026-10-17T01:00:00.000Z");
const later = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);
const OFFER = { title: "联系方式", fields: [{ label: "电话", value: "021 000 000" }] };

async function opened(email: string, input: { jobId?: string; startedBy?: "seeker" | "employer"; name?: string } = {}) {
  await ensureAccount(email);
  return openSharedConversation({
    seekerEmail: email,
    employerId: "e1",
    jobId: input.jobId ?? "j1",
    startedBy: input.startedBy ?? "seeker",
    seekerName: input.name,
    now: t0,
  });
}

describe("shared conversations (#110)", () => {
  it("one per job seeker, business and job, whichever side opens it", async () => {
    const first = await opened("Shared.One@example.com", { name: "小王" });
    const again = await openSharedConversation({
      seekerEmail: "shared.one@example.com",
      employerId: "e1",
      jobId: "j1",
      startedBy: "employer",
      seekerName: "别的名字",
    });
    expect(again.id).toBe(first.id);
    expect(again).toMatchObject({ startedBy: "seeker", seekerName: "小王", seekerEmail: "shared.one@example.com" });

    const otherJob = await opened("shared.one@example.com", { jobId: "j2" });
    expect(otherJob.id).not.toBe(first.id);
  });

  it("the job seeker and the business read the same messages; another business does not", async () => {
    const row = await opened("shared.two@example.com", { name: "小李" });
    await addSharedMessage(row.id, "seeker", "你好，还招人吗？", undefined, later(1));
    await addSharedMessage(row.id, "employer", "还招，明天来面试吧", "王经理", later(2));

    const [seekerSide] = await listSharedConversations({ side: "seeker", email: "SHARED.TWO@example.com" });
    const employerSide = (await listSharedConversations({ side: "employer", employerId: "e1" })).find(
      (c) => c.id === row.id,
    );
    expect(seekerSide.messages).toEqual([
      {
        id: expect.any(Number),
        from: "seeker",
        text: "你好，还招人吗？",
        sentAt: later(1).toISOString(),
        byName: null,
      },
      {
        id: expect.any(Number),
        from: "employer",
        text: "还招，明天来面试吧",
        sentAt: later(2).toISOString(),
        byName: "王经理",
      },
    ]);
    expect(employerSide?.messages).toEqual(seekerSide.messages);
    expect(seekerSide).toMatchObject({ employerId: "e1", jobId: "j1", seekerName: "小李" });
    expect(seekerSide.employerName).toBeTruthy();
    expect(seekerSide.jobTitle).toBeTruthy();
    // Whoever sends has read up to their message; the list is ordered by the newest one.
    expect(seekerSide).toMatchObject({
      seekerReadAt: later(1).toISOString(),
      employerReadAt: later(2).toISOString(),
      updatedAt: later(2).toISOString(),
    });

    expect(await listSharedConversations({ side: "employer", employerId: "e2" })).not.toContainEqual(
      expect.objectContaining({ id: row.id }),
    );
    expect(await findSharedConversation({ side: "employer", employerId: "e2" }, { rowId: row.id })).toBeUndefined();
    expect((await findSharedConversation({ side: "employer", employerId: "e1" }, { rowId: row.id }))?.id).toBe(row.id);
    expect(
      (
        await findSharedConversation(
          { side: "seeker", email: "shared.two@example.com" },
          { employerId: "e1", jobId: "j1" },
        )
      )?.id,
    ).toBe(row.id);
    expect(
      await findSharedConversation({ side: "seeker", email: "shared.one@example.com" }, { rowId: row.id }),
    ).toBeUndefined();

    await markSharedRead(row.id, "seeker", later(3));
    const [read] = await listSharedConversations({ side: "seeker", email: "shared.two@example.com" });
    expect(read.seekerReadAt).toBe(later(3).toISOString());
  });

  it("the business sees the name on the job seeker's page, and their 推荐人才 card only while it is shown", async () => {
    const row = await opened("shared.page@example.com", { startedBy: "employer", name: "申请时的名字" });
    const seen = async () =>
      (await listSharedConversations({ side: "employer", employerId: "e1" })).find((c) => c.id === row.id);
    expect(await seen()).toMatchObject({ seekerName: "申请时的名字" });
    expect((await seen())?.candidateId).toBeUndefined();

    await saveSeekerProfile("shared.page@example.com", {
      name: "陈晨",
      resume: { employmentTypes: [], regionIds: [], skills: "", candidateId: "abc", discoverable: true },
    });
    expect(await seen()).toMatchObject({ seekerName: "陈晨", candidateId: "local-abc" });

    await saveSeekerProfile("shared.page@example.com", {
      name: "陈晨",
      resume: { employmentTypes: [], regionIds: [], skills: "", candidateId: "abc", discoverable: false },
    });
    expect((await seen())?.candidateId).toBeUndefined();
  });

  it(`holds at most ${SHARED_MESSAGES_MAX} messages, also when the last ones are sent at once`, async () => {
    const row = await opened("shared.full@example.com");
    const db = await database();
    const sentAt = later(1).toISOString();
    const filler = Array.from({ length: SHARED_MESSAGES_MAX - 3 }, (_, i) => ({
      conversationId: row.id,
      from: "seeker" as const,
      text: `第 ${i + 1} 条`,
      sentAt,
    }));
    const [first, ...rest] = insertsInChunks(db, t.messages, filler);
    await db.batch([first, ...rest]);
    expect(await addSharedMessage(row.id, "employer", "还在吗", "王经理", later(2))).toBe(true);

    const atOnce = await Promise.all(
      Array.from({ length: 5 }, (_, i) => addSharedMessage(row.id, "seeker", `同时 ${i}`, undefined, later(3))),
    );
    expect(atOnce.filter(Boolean)).toHaveLength(2);
    expect(await addSharedMessage(row.id, "employer", "再发一条", "王经理", later(4))).toBe(false);
    // A refused message does not make the job seeker a candidate again once their candidate row is gone.
    const candidate = and(
      eq(t.jobApplications.seekerEmail, "shared.full@example.com"),
      eq(t.jobApplications.jobId, "j1"),
    );
    expect(await db.select().from(t.jobApplications).where(candidate)).toHaveLength(1);
    await db.delete(t.jobApplications).where(candidate);
    expect(await addSharedMessage(row.id, "seeker", "被拒的", undefined, later(5))).toBe(false);
    expect(await db.select().from(t.jobApplications).where(candidate)).toEqual([]);
    const [seen] = await listSharedConversations({ side: "seeker", email: "shared.full@example.com" });
    expect(seen.messages).toHaveLength(SHARED_MESSAGES_MAX);
    expect(seen.messages.at(-1)?.text).toMatch(/^同时/);
    expect(seen.employerReadAt).toBe(later(2).toISOString()); // the refused one changed nothing
  });

  it("an exchange is answered once", async () => {
    const row = await opened("shared.swap@example.com");
    await addSharedExchange(row.id, {
      id: "x-shared-1",
      kind: "contact",
      requestedBy: "employer",
      offered: OFFER,
      createdAt: later(1).toISOString(),
    });
    await answerSharedExchange(row.id, "x-shared-1", {
      status: "accepted",
      response: { title: "联系方式", fields: [{ label: "微信", value: "xiaowang" }] },
      respondedAt: later(2).toISOString(),
    });
    await answerSharedExchange(row.id, "x-shared-1", { status: "rejected", respondedAt: later(3).toISOString() });

    const [seen] = await listSharedConversations({ side: "seeker", email: "shared.swap@example.com" });
    expect(seen.exchanges).toEqual([
      {
        id: "x-shared-1",
        kind: "contact",
        requestedBy: "employer",
        status: "accepted",
        offered: OFFER,
        response: { title: "联系方式", fields: [{ label: "微信", value: "xiaowang" }] },
        createdAt: later(1).toISOString(),
        respondedAt: later(2).toISOString(),
      },
    ]);
    expect(seen.updatedAt).toBe(later(2).toISOString());
  });
});

describe("已约面 in the chat list (C7, ADR 0053)", () => {
  const invite = { slots: [], callFirst: true, mode: null, place: "", note: "" };
  const seeker = { side: "seeker" as const, email: "interview.list@example.com" };
  const business = { side: "employer" as const, employerId: "e1" };
  /**
   * The conversation's mark on both sides, from a full read and from a read of changes (the heads every 10-second
   * read has).
   */
  async function marks(id: string) {
    const since = { messageId: 0, at: later(100).toISOString() };
    const of = (rows: { id: string; interview: boolean }[]) => rows.filter((r) => r.id === id).map((r) => r.interview);
    return Promise.all(
      [seeker, business].flatMap((reader) => [
        listSharedConversations(reader).then(of),
        listSharedChanges(reader, since, Number.MAX_SAFE_INTEGER).then(({ heads }) => of(heads)),
      ]),
    );
  }

  it("is marked with no interview, an invitation in play, and one called off or turned down, as each should be", async () => {
    const row = await opened(seeker.email);
    await addSharedMessage(row.id, "seeker", "你好，还招人吗？", undefined, later(1));
    // The job seeker's first message made them one of the job's candidates (ADR 0030): the application.
    const [application] = await (
      await database()
    )
      .select()
      .from(t.jobApplications)
      .where(and(eq(t.jobApplications.seekerEmail, seeker.email), eq(t.jobApplications.jobId, "j1")));
    expect(await marks(row.id)).toEqual([[false], [false], [false], [false]]);

    await inviteToInterview("e1", application.id, invite, later(2));
    expect(await marks(row.id)).toEqual([[true], [true], [true], [true]]);
    await answerInterview(application.id, { kind: "confirm", slot: null }, later(3));
    expect(await marks(row.id)).toEqual([[true], [true], [true], [true]]);

    await cancelInterview("e1", application.id, later(4));
    expect(await marks(row.id)).toEqual([[false], [false], [false], [false]]);
    await inviteToInterview("e1", application.id, invite, later(5));
    await answerInterview(application.id, { kind: "decline", reply: "不去了" }, later(6));
    expect(await marks(row.id)).toEqual([[false], [false], [false], [false]]);
  });

  it("does not mark another job's conversation of the same job seeker", async () => {
    const row = await opened(seeker.email);
    const other = await opened(seeker.email, { jobId: "j2" });
    await addSharedMessage(row.id, "seeker", "你好", undefined, later(1));
    await addSharedMessage(other.id, "seeker", "你好", undefined, later(1));
    const [application] = await (
      await database()
    )
      .select()
      .from(t.jobApplications)
      .where(and(eq(t.jobApplications.seekerEmail, seeker.email), eq(t.jobApplications.jobId, "j1")));
    await inviteToInterview("e1", application.id, invite, later(2));
    const rows = (await listSharedConversations(seeker)).filter((r) => [row.id, other.id].includes(r.id));
    expect(Object.fromEntries(rows.map((r) => [r.jobId, r.interview]))).toEqual({ j1: true, j2: false });
  });
});
