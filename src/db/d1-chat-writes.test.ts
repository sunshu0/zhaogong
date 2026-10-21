// These run on libSQL and local D1: failed batches must leave no message, candidate, evidence or guard behind.
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { addSharedExchange, addSharedMessage, answerSharedExchange, openSharedConversation } from "@/db/conversations";
import { guardedBatch } from "@/db/guarded-batch";
import { database, resetDatabaseForTests } from "@/db/ready";
import { listReportEvidence } from "@/db/report-evidence";
import * as t from "@/db/schema";
import { failOn } from "@/db/testing/fail-trigger";
import { createEmployer, ensureAccount, getAccount, openEmployerIdentity, submitReport } from "@/lib/data";

beforeEach(() => resetDatabaseForTests());

async function conversation() {
  await ensureAccount("batch.seeker@example.com");
  return openSharedConversation({
    seekerEmail: "batch.seeker@example.com",
    employerId: "e1",
    jobId: "j1",
    startedBy: "seeker",
  });
}

async function guardsAreEmpty() {
  expect(await (await database()).select().from(t.writeGuards)).toEqual([]);
}

describe("guarded batches", () => {
  it("does nothing when its condition fails and leaves no guard when it succeeds", async () => {
    const db = await database();
    const write = (allowed: ReturnType<typeof sql>) =>
      [
        db
          .update(t.employers)
          .set({ name: "Changed" })
          .where(and(eq(t.employers.id, "e1"), allowed)),
      ] as const;
    expect((await guardedBatch(db, sql`false`, write)).applied).toBe(false);
    expect((await db.select().from(t.employers).where(eq(t.employers.id, "e1")))[0].name).not.toBe("Changed");
    expect((await guardedBatch(db, sql`true`, write)).applied).toBe(true);
    await guardsAreEmpty();
  });
});

describe("chat writes on D1", () => {
  it("keeps one candidate while concurrent messages are all preserved", async () => {
    const chat = await conversation();
    await Promise.all(
      Array.from({ length: 5 }, (_, i) => addSharedMessage(chat.id, "seeker", `message ${i}`, undefined)),
    );
    const db = await database();
    expect(await db.select().from(t.messages).where(eq(t.messages.conversationId, chat.id))).toHaveLength(5);
    expect(
      await db.select().from(t.jobApplications).where(eq(t.jobApplications.seekerEmail, chat.seekerEmail)),
    ).toHaveLength(1);
  });

  it("rolls back the message and candidate when updating the conversation fails", async () => {
    const chat = await conversation();
    const db = await database();
    const remove = await failOn(db, "conversations", "UPDATE");
    try {
      await expect(addSharedMessage(chat.id, "seeker", "not saved", undefined)).rejects.toThrow();
    } finally {
      await remove();
    }
    expect(await db.select().from(t.messages).where(eq(t.messages.conversationId, chat.id))).toEqual([]);
    expect(
      await db.select().from(t.jobApplications).where(eq(t.jobApplications.seekerEmail, chat.seekerEmail)),
    ).toEqual([]);
  });

  it("answers once, and a repeated answer cannot move the conversation back before a later message", async () => {
    const chat = await conversation();
    await addSharedExchange(chat.id, {
      id: "exchange-batch",
      kind: "contact",
      requestedBy: "seeker",
      offered: { title: "phone", fields: [{ label: "phone", value: "021000000" }] },
      createdAt: "2026-10-22T00:00:00Z",
    });
    const accepted = { status: "accepted" as const, respondedAt: "2026-10-22T01:00:00Z" };
    await Promise.all([
      answerSharedExchange(chat.id, "exchange-batch", accepted),
      answerSharedExchange(chat.id, "exchange-batch", { status: "rejected", respondedAt: "2026-10-22T02:00:00Z" }),
    ]);
    const later = new Date("2026-10-23T00:00:00Z");
    await addSharedMessage(chat.id, "seeker", "later", undefined, later);
    const db = await database();
    const [exchange] = await db.select().from(t.exchanges).where(eq(t.exchanges.id, "exchange-batch"));
    await answerSharedExchange(chat.id, "exchange-batch", {
      status: exchange.status,
      respondedAt: exchange.respondedAt!,
    });
    const [after] = await db.select().from(t.conversations).where(eq(t.conversations.id, chat.id));
    expect(after.updatedAt).toBe(later.toISOString());
    await guardsAreEmpty();
  });

  it("rolls back both the answer and its guard when the conversation update fails", async () => {
    const chat = await conversation();
    await addSharedExchange(chat.id, {
      id: "exchange-rollback",
      kind: "contact",
      requestedBy: "seeker",
      offered: { title: "phone", fields: [] },
      createdAt: new Date().toISOString(),
    });
    const db = await database();
    const remove = await failOn(db, "conversations", "UPDATE");
    try {
      await expect(
        answerSharedExchange(chat.id, "exchange-rollback", {
          status: "rejected",
          respondedAt: new Date().toISOString(),
        }),
      ).rejects.toThrow();
    } finally {
      await remove();
    }
    expect((await db.select().from(t.exchanges).where(eq(t.exchanges.id, "exchange-rollback")))[0].status).toBe(
      "pending",
    );
    await guardsAreEmpty();
  });
});

describe("report and identity writes on D1", () => {
  it("keeps each concurrent report's own evidence, with unique report ids", async () => {
    const reports = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        submitReport("j1", "other", `report ${i}`, {
          reporterEmail: "reporter@example.com",
          messages: [
            { messageId: i, from: "seeker", byName: null, text: `evidence ${i}`, sentAt: new Date().toISOString() },
          ],
        }),
      ),
    );
    expect(new Set(reports.map((r) => r.id)).size).toBe(5);
    for (const [i, report] of reports.entries())
      expect(await listReportEvidence(report.id)).toMatchObject([{ text: `evidence ${i}` }]);
  });

  it("leaves no report if saving its evidence fails", async () => {
    const db = await database();
    const before = await db.select().from(t.reports);
    const remove = await failOn(db, "report_evidence", "INSERT");
    try {
      await expect(
        submitReport("j1", "other", "not saved", {
          reporterEmail: "reporter@example.com",
          messages: [],
          images: [{ key: "image", type: "image/png", bytes: 10 }],
        }),
      ).rejects.toThrow();
    } finally {
      await remove();
    }
    expect(await db.select().from(t.reports)).toEqual(before);
  });

  it("cannot bind one account to two businesses when both requests start together", async () => {
    const email = "competing.identity@example.com";
    await ensureAccount(email);
    const businesses = await Promise.all(["One", "Two"].map((name) => createEmployer({ name, regionId: "akl-cbd" })));
    expect(new Set(businesses.map((b) => b.id)).size).toBe(2);
    const results = await Promise.all(businesses.map((b) => openEmployerIdentity(email, b.id)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ reason: "already_employer" });
    expect(businesses.map((b) => b.id)).toContain((await getAccount(email))!.employerId);
  });
});
