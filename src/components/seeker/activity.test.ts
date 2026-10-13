import { describe, expect, it } from "vitest";
import {
  addSentReport,
  addViewedJob,
  clearViewedJobs,
  readSentReports,
  readViewedJobs,
  REPORTS_KEY,
  VIEWS_KEY,
  type SentReport,
  type ViewedJob,
} from "@/components/seeker/activity";
import type { StorageLike } from "@/components/seeker/session";

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const report = (n: number, jobId = `j${n}`): SentReport => ({
  reportId: `r${n}`,
  jobId,
  jobTitle: `职位 ${n}`,
  reason: "fake_job",
  at: new Date(Date.UTC(2026, 9, 12, 0, n)).toISOString(),
});

describe("reports sent from this device", () => {
  it("starts empty and lists the newest first", () => {
    const storage = memoryStorage();
    expect(readSentReports(storage)).toEqual([]);
    addSentReport(storage, report(1));
    addSentReport(storage, report(2));
    expect(readSentReports(storage).map((r) => r.reportId)).toEqual(["r2", "r1"]);
  });

  it("keeps at most 50", () => {
    const storage = memoryStorage();
    for (let n = 1; n <= 55; n++) addSentReport(storage, report(n));
    const list = readSentReports(storage);
    expect(list).toHaveLength(50);
    expect(list[0].reportId).toBe("r55");
  });

  it("drops entries that are broken or tampered with", () => {
    const storage = memoryStorage();
    storage.data.set(
      REPORTS_KEY,
      JSON.stringify([report(1), { reportId: "r2" }, null, { ...report(3), reason: "spam" }]),
    );
    expect(readSentReports(storage).map((r) => r.reportId)).toEqual(["r1"]);
    storage.data.set(REPORTS_KEY, "not json");
    expect(readSentReports(storage)).toEqual([]);
  });
});

const view = (n: number, jobId = `j${n}`): ViewedJob => ({
  jobId,
  title: `职位 ${n}`,
  pay: "$25/小时",
  region: "市中心",
  at: new Date(Date.UTC(2026, 9, 12, 0, n)).toISOString(),
});

describe("jobs viewed on this device", () => {
  it("lists the most recently viewed first and moves a job back to the top when seen again", () => {
    const storage = memoryStorage();
    expect(readViewedJobs(storage)).toEqual([]);
    addViewedJob(storage, view(1));
    addViewedJob(storage, view(2));
    addViewedJob(storage, view(3, "j1"));
    const list = readViewedJobs(storage);
    expect(list.map((v) => v.jobId)).toEqual(["j1", "j2"]);
    expect(list[0].at).toBe(view(3).at);
  });

  it("keeps at most 30", () => {
    const storage = memoryStorage();
    for (let n = 1; n <= 35; n++) addViewedJob(storage, view(n));
    expect(readViewedJobs(storage)).toHaveLength(30);
  });

  it("can be cleared", () => {
    const storage = memoryStorage();
    addViewedJob(storage, view(1));
    clearViewedJobs(storage);
    expect(readViewedJobs(storage)).toEqual([]);
  });

  it("drops entries that are broken or tampered with", () => {
    const storage = memoryStorage();
    storage.data.set(VIEWS_KEY, JSON.stringify([view(1), { jobId: "j2" }, 7]));
    expect(readViewedJobs(storage).map((v) => v.jobId)).toEqual(["j1"]);
  });
});
