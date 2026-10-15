import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { resetDatabaseForTests } from "@/db/ready";
import { createEmployer, ensureAccount, listEmployers, openEmployerIdentity, submitReport } from "@/lib/data";

describe("many requests writing at once to a database file", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "zhaogong-busy-"));
  const saved = process.env.DATABASE_URL;
  afterAll(() => {
    resetDatabaseForTests();
    process.env.DATABASE_URL = saved;
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {}
  });

  it("never fails with SQLITE_BUSY (database is locked), and gives every business its own id", async () => {
    process.env.DATABASE_URL = `file:${path.join(dir, "zhaogong.db")}`;
    resetDatabaseForTests();
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, async (_, i) => {
        const employer = await createEmployer({ name: `并发店${i}`, regionId: "akl-cbd" });
        await ensureAccount(`busy${i}@example.com`);
        await openEmployerIdentity(`busy${i}@example.com`, employer.id);
        await submitReport("j1", "other");
      }),
    );
    expect(results.filter((r) => r.status === "rejected")).toEqual([]);
    const ids = (await listEmployers()).map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
