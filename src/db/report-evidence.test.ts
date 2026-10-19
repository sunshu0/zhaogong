import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteAccount, exportAccountData } from "@/db/account-data";
import { addSharedMessage, openSharedConversation } from "@/db/conversations";
import { memoryStore, setEvidenceStoreForTests } from "@/db/evidence-store";
import { database } from "@/db/ready";
import {
  findOwnMessages,
  listPickableMessages,
  listReportEvidence,
  purgeExpiredEvidence,
  resetEvidenceCleanupForTests,
} from "@/db/report-evidence";
import * as t from "@/db/schema";
import { ensureAccount, submitReport, updateReport } from "@/lib/data";
import { EVIDENCE_KEEP_DAYS, parseEvidenceIds } from "@/lib/report-evidence";

const t0 = new Date("2026-10-20T01:00:00.000Z");
const later = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

/** A chat of `email` with business e1 about job j1 (or j2), and one with e2 about j3; returns e1's message ids. */
async function chats(email: string) {
  await ensureAccount(email);
  const j1 = await openSharedConversation({ seekerEmail: email, employerId: "e1", jobId: "j1", startedBy: "seeker" });
  const j2 = await openSharedConversation({ seekerEmail: email, employerId: "e1", jobId: "j2", startedBy: "seeker" });
  const e2 = await openSharedConversation({ seekerEmail: email, employerId: "e2", jobId: "j3", startedBy: "seeker" });
  await addSharedMessage(j1.id, "seeker", "你好，还招人吗？", undefined, later(1));
  await addSharedMessage(j1.id, "employer", "入职前先交 200 元押金", "王经理", later(2));
  await addSharedMessage(j2.id, "employer", "这个也要交押金", "王经理", later(3));
  await addSharedMessage(e2.id, "employer", "别的公司", undefined, later(4));
  return (await listPickableMessages(email, "e1")).map((m) => m.id);
}

beforeEach(() => resetEvidenceCleanupForTests());

describe("parseEvidenceIds (ADR 0027)", () => {
  it("takes up to 20 different positive whole numbers", () => {
    expect(parseEvidenceIds(undefined)).toEqual([]);
    expect(parseEvidenceIds([3, 1, 3])).toEqual([3, 1]);
    expect(parseEvidenceIds(Array.from({ length: 20 }, (_, i) => i + 1))).toHaveLength(20);
    expect(parseEvidenceIds(Array.from({ length: 21 }, (_, i) => i + 1))).toBeUndefined();
    expect(parseEvidenceIds([1.5])).toBeUndefined();
    expect(parseEvidenceIds(["1"])).toBeUndefined();
    expect(parseEvidenceIds("1")).toBeUndefined();
  });
});

describe("report evidence: chat messages (ADR 0027)", () => {
  it("lists the job seeker's messages with the job's business, every chat of it, oldest first", async () => {
    await chats("evidence.list@example.com");
    const listed = await listPickableMessages("Evidence.List@example.com", "e1");
    expect(listed.map(({ mine, byName, text }) => ({ mine, byName, text }))).toEqual([
      { mine: true, byName: null, text: "你好，还招人吗？" },
      { mine: false, byName: "王经理", text: "入职前先交 200 元押金" },
      { mine: false, byName: "王经理", text: "这个也要交押金" },
    ]);
    expect(await listPickableMessages("someone.else@example.com", "e1")).toEqual([]);
  });

  it("finds only the reporter's own messages with that business", async () => {
    const ids = await chats("evidence.own@example.com");
    const [other] = await listPickableMessages("evidence.own@example.com", "e2");
    expect(await findOwnMessages("evidence.own@example.com", "e1", ids)).toHaveLength(3);
    expect(await findOwnMessages("evidence.own@example.com", "e1", [ids[0], other.id])).toHaveLength(1);
    expect(await findOwnMessages("not.them@example.com", "e1", ids)).toEqual([]);
  });

  it("keeps a copy with the report, in the order sent, and deletes it 180 days after the report is handled", async () => {
    const email = "evidence.keep@example.com";
    const ids = await chats(email);
    const messages = await findOwnMessages(email, "e1", [ids[2], ids[1]]);
    const report = await submitReport("j1", "charges_fee", undefined, { reporterEmail: email, messages });
    const kept = await submitReport("j1", "charges_fee", undefined, { reporterEmail: email, messages });
    expect(await listReportEvidence(report.id)).toMatchObject([
      { kind: "message", from: "employer", byName: "王经理", text: "入职前先交 200 元押金" },
      { kind: "message", from: "employer", byName: "王经理", text: "这个也要交押金" },
    ]);

    const handled = new Date("2026-01-01T00:00:00.000Z");
    await updateReport(report.id, "actioned", handled);
    await updateReport(kept.id, "dismissed", new Date());
    expect(await purgeExpiredEvidence(new Date(handled.getTime() + (EVIDENCE_KEEP_DAYS - 1) * 86_400_000))).toBe(0);
    resetEvidenceCleanupForTests();
    expect(await purgeExpiredEvidence(new Date(handled.getTime() + (EVIDENCE_KEEP_DAYS + 1) * 86_400_000))).toBe(2);
    expect(await listReportEvidence(report.id)).toEqual([]);
    expect(await listReportEvidence(kept.id)).toHaveLength(2);
    // Once a day: a second call on the same day does nothing.
    expect(await purgeExpiredEvidence(new Date(handled.getTime() + (EVIDENCE_KEEP_DAYS + 1) * 86_400_000))).toBe(0);
  });

  it("is in the reporter's export and goes with their account; the report stays", async () => {
    const email = "evidence.gone@example.com";
    const ids = await chats(email);
    const messages = await findOwnMessages(email, "e1", [ids[1]]);
    const report = await submitReport("j1", "charges_fee", "押金", { reporterEmail: email, messages });
    expect((await exportAccountData(email))?.reportEvidence).toEqual([
      {
        reportId: report.id,
        kind: "message",
        messageFrom: "employer",
        messageText: "入职前先交 200 元押金",
        messageSentAt: later(2).toISOString(),
        createdAt: report.createdAt,
      },
    ]);
    expect(await deleteAccount(email)).toBe("deleted");
    expect(await listReportEvidence(report.id)).toEqual([]);
    const db = await database();
    const reports = await db.select({ id: t.reports.id }).from(t.reports);
    expect(reports.map((r) => r.id)).toContain(report.id);
  });
});

describe("report evidence: screenshots (ADR 0027 §2)", () => {
  it("keeps the files' keys with the report and removes the files when the evidence goes", async () => {
    const store = memoryStore();
    setEvidenceStoreForTests(store);
    try {
      const email = "evidence.images@example.com";
      await ensureAccount(email);
      const keys = [randomUUID(), randomUUID()];
      for (const key of keys) await store.put(key, new Uint8Array([1, 2, 3]), "image/png");
      const images = keys.map((key) => ({ key, type: "image/png" as const, bytes: 3 }));
      const first = await submitReport("j1", "charges_fee", undefined, { reporterEmail: email, messages: [], images });
      const [shown] = await listReportEvidence(first.id);
      expect(shown).toMatchObject({ kind: "image", type: "image/png", bytes: 3 });
      expect(shown.kind === "image" && shown.url).toMatch(/^\/api\/report-evidence\/\d+$/);
      expect((await exportAccountData(email))?.reportEvidence).toMatchObject([
        { kind: "image", imageType: "image/png", imageBytes: 3 },
        { kind: "image", imageType: "image/png", imageBytes: 3 },
      ]);

      const handled = new Date("2026-01-01T00:00:00.000Z");
      await updateReport(first.id, "actioned", handled);
      expect(await purgeExpiredEvidence(new Date(handled.getTime() + (EVIDENCE_KEEP_DAYS + 1) * 86_400_000))).toBe(2);
      expect(store.keys()).toEqual([]);

      const again = randomUUID();
      await store.put(again, new Uint8Array([4]), "image/png");
      await submitReport("j1", "charges_fee", undefined, {
        reporterEmail: email,
        messages: [],
        images: [{ key: again, type: "image/png", bytes: 1 }],
      });
      expect(await deleteAccount(email)).toBe("deleted");
      expect(store.keys()).toEqual([]);
    } finally {
      setEvidenceStoreForTests(undefined);
    }
  });
});
