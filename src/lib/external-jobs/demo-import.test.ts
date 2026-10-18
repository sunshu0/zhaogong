// Real jobs in a fresh demo database (demo-import.ts), against the hand-made API answers: no test reads a real API.
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import type { ExternalCompany } from "@/config/external-companies";
import { getExternalJob, listExternalJobs } from "@/db/external-jobs";
import { resetDatabaseForTests } from "@/db/ready";
import { listModerationLog } from "@/lib/data";
import { DEMO_MODERATOR } from "@/lib/demo-accounts";
import { isDemoCompany } from "@/lib/external-jobs/demo";
import { AUTO_APPROVED_NOTE, describeDemoImport, importRealJobsIntoDemo } from "@/lib/external-jobs/demo-import";
import { postingsUrl } from "@/lib/external-jobs/sources";

const GREENHOUSE = JSON.parse(
  readFileSync(path.join(process.cwd(), "src/lib/external-jobs/fixtures", "greenhouse-kowhai.json"), "utf8"),
);
const KOWHAI: ExternalCompany = {
  id: "kowhai",
  name: "Kowhai Robotics",
  source: "greenhouse",
  board: "kowhai",
  careersUrl: "https://kowhai.example.com/careers",
  terms: { checkedBy: "测试", checkedOn: "2026-10-17", allowsDisplay: true, note: "test company, made up" },
};
const now = () => new Date("2026-10-17T01:00:00.000Z");
const demoUp = async () =>
  (await listExternalJobs()).filter((job) => isDemoCompany(job.companyId) && job.removedAt == null);

beforeEach(() => resetDatabaseForTests());

describe("real external jobs in the demo database (导师 10-19)", () => {
  it("offline: keeps the made-up jobs and approves nothing", async () => {
    const before = (await demoUp()).length;
    expect(before).toBeGreaterThan(0);
    const result = await importRealJobsIntoDemo({
      companies: [KOWHAI],
      getJson: async () => {
        throw new Error("fetch failed");
      },
      now,
    });
    expect(result).toMatchObject({ imported: false, approved: 0, retired: 0 });
    expect(describeDemoImport(result)).toMatch(/keeps its made-up ones \(kowhai: fetch failed\)/);
    expect(await demoUp()).toHaveLength(before);
    expect((await listModerationLog()).filter((e) => e.action === "external_approve")).toEqual([]);
  });

  it("online: the unflagged real jobs show, approved by the demo moderator in the log; flagged ones wait", async () => {
    const result = await importRealJobsIntoDemo({
      companies: [KOWHAI],
      getJson: async (url) => {
        if (url !== postingsUrl("greenhouse", "kowhai")) throw new Error(`${url} answered 404`);
        return structuredClone(GREENHOUSE);
      },
      now,
    });
    expect(result.imported).toBe(true);
    expect(await getExternalJob("kowhai:4001")).toMatchObject({ review: "approved" });
    expect(await getExternalJob("kowhai:4002")).toMatchObject({ review: "pending", flags: ["other_citizenship"] });
    const approvals = (await listModerationLog()).filter((e) => e.action === "external_approve");
    expect(approvals).toHaveLength(result.approved);
    expect(approvals.find((e) => e.jobId === "kowhai:4001")).toMatchObject({
      moderator: DEMO_MODERATOR,
      note: AUTO_APPROVED_NOTE,
      employerName: "Kowhai Robotics",
    });
    // The made-up jobs come down (kept as rows: a saved one still says it is gone).
    expect(await demoUp()).toEqual([]);
    expect(result.retired).toBeGreaterThan(0);
    expect(describeDemoImport(result)).toBe(
      `External jobs: real jobs imported, ${result.approved} approved by the demo moderator, ${result.retired} made-up ones taken down.`,
    );
  });
});
