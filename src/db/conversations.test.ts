import { describe, expect, it } from "vitest";
import {
  addSharedExchange,
  addSharedMessage,
  answerSharedExchange,
  findSharedConversation,
  listSharedConversations,
  markSharedRead,
  openSharedConversation,
} from "@/db/conversations";
import { saveSeekerProfile } from "@/db/seeker-profiles";
import { ensureAccount } from "@/lib/data";

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
      { from: "seeker", text: "你好，还招人吗？", sentAt: later(1).toISOString(), byName: null },
      { from: "employer", text: "还招，明天来面试吧", sentAt: later(2).toISOString(), byName: "王经理" },
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
