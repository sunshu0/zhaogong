import { describe, expect, it } from "vitest";
import { DEMO_SEEKER, demoShowcase } from "@/db/demo-showcase";
import { listJobAlertHits, listJobAlerts } from "@/db/job-alerts";
import { listSavedJobs } from "@/db/saved-jobs";
import { listPendingVerifications } from "@/db/verification-requests";
import { canRepublish, jobPhase, renewState } from "@/components/employer/job-status";
import { checkJob, publishDecision } from "@/lib/compliance";
import { getEmployer, getJob, listJobsByEmployer, listReports, matchesFilter } from "@/lib/data";
import { alertFilter } from "@/components/seeker/job-alerts";

const DAY = 86_400_000;

describe("the demo shows the newer features in use (#88)", () => {
  it("gives 川味小馆 a job closing in 2 days to renew and one closed 20 days ago to publish again", async () => {
    const now = Date.now();
    // Only the showcase's jobs, dated from the seeding: the test is about them, not 川味小馆's other demo jobs
    // (收银员 j17 is closed by its status, and whether it can be published again follows its own dates in mock/data.ts).
    const showcase = new Set(demoShowcase(now).jobs.map((j) => j.id));
    const jobs = (await listJobsByEmployer("e1")).filter((j) => showcase.has(j.id));
    const ending = jobs.filter((j) => jobPhase(j, now) === "ending");
    const old = jobs.filter((j) => canRepublish(j, now));
    expect(ending.map((j) => j.titleZh)).toEqual(["外卖打包员"]);
    expect(renewState(ending[0], now).allowed).toBe(true);
    expect(old.map((j) => j.titleZh)).toEqual(["洗碗工"]);
  });

  it("fills the moderation queue: a job held at posting by the checks, and two open reports", async () => {
    const held = (await getJob("j23"))!;
    expect(held.status).toBe("pending_review");
    const decision = publishDecision(checkJob(held, held.country, await getEmployer(held.employerId)));
    expect(decision).toMatchObject({ canPublish: true, status: "pending_review" }); // held for a person, as at posting
    const reports = (await listReports()).filter((r) => r.id === "r1" || r.id === "r2");
    expect(reports.map((r) => [r.reason, r.status])).toEqual([
      ["charges_fee", "open"],
      ["below_min_wage", "open"],
    ]);
  });

  it("gives the demo job seeker saved jobs and an alert that found a job it really matches", async () => {
    expect((await listSavedJobs(DEMO_SEEKER)).map((s) => [s.jobId, s.stage])).toEqual([
      ["j3", null],
      ["j1", "contacted"],
    ]);
    const [alert] = await listJobAlerts(DEMO_SEEKER);
    const [hit] = await listJobAlertHits(DEMO_SEEKER);
    expect(hit).toMatchObject({ jobId: "j22", alertName: alert.name });
    expect(matchesFilter((await getJob(hit.jobId))!, alertFilter(alert))).toBe(true);
  });

  it("has two 企业验证 applications waiting, one for each badge (#78)", async () => {
    const waiting = await listPendingVerifications();
    expect(waiting.filter((r) => r.id === "v1" || r.id === "v2").map((r) => [r.tradingName, r.kind])).toEqual([
      ["安居装修", "accredited_employer"],
      ["悦美发型工作室", "business_verified"],
    ]);
    expect((await getEmployer("e4"))?.verification).toBe("unverified"); // waiting, not verified
  });

  it("counts every date from the day it is loaded, and reads as real, not as a test", () => {
    const now = Date.UTC(2026, 11, 1);
    const showcase = demoShowcase(now);
    const j20 = showcase.jobs.find((j) => j.id === "j20")!;
    expect(Date.parse(j20.expiresAt) - now).toBe(2 * DAY);
    expect(JSON.stringify(showcase)).not.toMatch(/测试|test/i);
  });
});
