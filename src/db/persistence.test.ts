import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDatabaseForTests } from "@/db/ready";
import {
  addModerationLog,
  banEmployer,
  getEmployer,
  getJob,
  listContactViews,
  listModerationLog,
  listReports,
  recordContactView,
  submitReport,
  updateReport,
} from "@/lib/data";

// Reports, moderation decisions and contact views (#11) are written to the database file, so they are
// still there after the server restarts — which the in-memory lists were not.
describe("kept across a restart", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "zhaogong-db-"));
  const saved = process.env.DATABASE_URL;

  /** What a server restart does to the database: the connection goes, the file stays. */
  const restart = () => resetDatabaseForTests();

  beforeAll(() => {
    process.env.DATABASE_URL = `file:${path.join(dir, "zhaogong.db")}`;
    restart();
  });
  afterAll(() => {
    restart();
    process.env.DATABASE_URL = saved;
    // Windows may hold the closed file a moment longer; a leftover temp folder does no harm.
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {}
  });

  it("keeps reports, their status and when they were closed", async () => {
    const report = await submitReport("j1", "charges_fee", "电话里说要交押金");
    await updateReport(report.id, "actioned", new Date("2026-10-16T02:00:00.000Z"));
    restart();
    expect((await listReports()).filter((r) => r.id === report.id)).toEqual([
      { ...report, status: "actioned", handledAt: "2026-10-16T02:00:00.000Z" }, // #70
    ]);
  });

  it("keeps moderation decisions and a ban, with the jobs it took down", async () => {
    const entry = await addModerationLog({
      action: "ban",
      employerId: "e4",
      employerName: "测试",
      takenDown: 1,
      moderator: "m@example.com",
    });
    const takenDown = await banEmployer("e4");
    restart();
    expect((await listModerationLog())[0]).toEqual(entry);
    expect((await getEmployer("e4"))?.bannedAt).toBeDefined();
    for (const id of takenDown) expect((await getJob(id))?.status).toBe("removed");
  });

  it("keeps who revealed a job's contact details", async () => {
    const before = (await listContactViews("j3")).length;
    await recordContactView("j3", "viewer@example.com");
    restart();
    const views = await listContactViews("j3");
    expect(views).toHaveLength(before + 1);
    expect(views[0].viewerEmail).toBe("viewer@example.com");
  });

  it("loads the demo data only into the empty file, not again after a restart", async () => {
    restart();
    // The demo's two reports (#88) and the one the first test sent; the demo is not loaded a second time.
    expect((await listReports()).length).toBe(3);
  });
});
