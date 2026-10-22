import { describe, expect, it } from "vitest";
import { listSavedJobs, saveJob, setSavedStage, unsaveJob } from "@/db/saved-jobs";
import { eq } from "drizzle-orm";
import { database } from "@/db/ready";
import { jobs } from "@/db/schema";
import { ensureAccount } from "@/lib/data";

const t0 = new Date("2026-10-16T01:00:00.000Z");
const later = (ms: number) => new Date(t0.getTime() + ms);

describe("saved jobs (#52)", () => {
  it("saves a demo job once per account, newest first, and only for an account and a job that exist", async () => {
    expect(await saveJob("nobody@example.com", "j3", t0)).toBe("no_account");
    await ensureAccount("saver@example.com");
    expect(await saveJob("saver@example.com", "no-such-job", t0)).toBe("no_job");
    expect(await saveJob(" Saver@Example.com ", "j3", t0)).toBe("saved");
    expect(await saveJob("saver@example.com", "j5", later(1000))).toBe("saved");
    expect(await saveJob("saver@example.com", "j3", later(2000))).toBe("already");
    const rows = await listSavedJobs("saver@example.com");
    expect(rows.map((r) => [r.jobId, r.savedAt, r.stage])).toEqual([
      ["j5", later(1000).toISOString(), null],
      ["j3", t0.toISOString(), null],
    ]);
  });

  it("does not save a job held for review or taken down, so the list cannot show it (security review)", async () => {
    await ensureAccount("prober@example.com");
    const db = await database();
    for (const [id, status] of [
      ["j8", "pending_review"],
      ["j9", "removed"],
    ] as const) {
      await db.update(jobs).set({ status }).where(eq(jobs.id, id));
      expect(await saveJob("prober@example.com", id, t0)).toBe("no_job");
    }
    expect(await listSavedJobs("prober@example.com")).toEqual([]);
    await db.update(jobs).set({ status: "expired" }).where(eq(jobs.id, "j9"));
    expect(await saveJob("prober@example.com", "j9", t0)).toBe("saved");
  });

  it("keeps each account's list to itself", async () => {
    await ensureAccount("other@example.com");
    await saveJob("other@example.com", "j1", t0);
    expect((await listSavedJobs("other@example.com")).map((r) => r.jobId)).toEqual(["j1"]);
    expect((await listSavedJobs("saver@example.com")).map((r) => r.jobId)).not.toContain("j1");
  });

  it("sets the stage the account picked; saving again keeps it; removing takes it all", async () => {
    expect(await setSavedStage("saver@example.com", "j3", "interviewed", later(5000))).toBe(true);
    expect(await setSavedStage("saver@example.com", "j11", "hired")).toBe(false); // not saved
    await saveJob("saver@example.com", "j3", later(6000));
    const j3 = (await listSavedJobs("saver@example.com")).find((r) => r.jobId === "j3")!;
    expect(j3).toMatchObject({
      stage: "interviewed",
      stageSetAt: later(5000).toISOString(),
      savedAt: t0.toISOString(),
    });

    await unsaveJob("saver@example.com", "j3");
    expect((await listSavedJobs("saver@example.com")).map((r) => r.jobId)).toEqual(["j5"]);
  });
});
