import { describe, expect, it } from "vitest";
import {
  createJobAlert,
  deleteJobAlert,
  listJobAlertHits,
  listJobAlerts,
  matchJobAlerts,
  updateJobAlert,
} from "@/db/job-alerts";
import { createJob, ensureAccount, openEmployerIdentity } from "@/lib/data";
import type { Job } from "@/lib/types";
import { MOCK_JOBS } from "@/mock/data";
import { ALERT_LIMIT, normalizeAlertQuery } from "@/components/seeker/job-alerts";

const NOW = new Date("2026-10-16T00:00:00.000Z");
const alert = (query: string, name = query || "全部") => ({ name, country: "NZ" as const, query });

/** A live job of e1 (川味小馆), posted now. */
function newJob(patch: Partial<Job> = {}) {
  return createJob({
    ...MOCK_JOBS[0],
    titleZh: "提醒测试职位",
    descriptionZh: "提醒测试",
    postedAt: NOW.toISOString(),
    expiresAt: "2099-01-01T00:00:00.000Z",
    ...patch,
  });
}

describe("job alerts in the database (#53)", () => {
  it("saves a search once, up to five per account", async () => {
    await ensureAccount("alerts.limit@example.com");
    expect(await createJobAlert("nobody.here@example.com", alert("q=a"))).toEqual({ status: "no_account" });
    const first = await createJobAlert(" Alerts.Limit@example.com ", alert("industry=hospitality&q=上限"), NOW);
    expect(first).toMatchObject({ status: "created", alert: { email: "alerts.limit@example.com", paused: false } });
    expect(
      await createJobAlert("alerts.limit@example.com", alert("industry=hospitality&q=上限", "又一个")),
    ).toMatchObject({
      status: "exists",
      alert: { name: "industry=hospitality&q=上限" },
    });
    for (let i = 2; i <= ALERT_LIMIT; i++)
      expect((await createJobAlert("alerts.limit@example.com", alert(`q=上限${i}`))).status).toBe("created");
    expect(await createJobAlert("alerts.limit@example.com", alert("q=上限6"))).toEqual({ status: "limit" });
    expect(await listJobAlerts("alerts.limit@example.com")).toHaveLength(ALERT_LIMIT);
  });

  it("renames, pauses and deletes the account's own alerts only", async () => {
    await ensureAccount("alerts.owner@example.com");
    await ensureAccount("alerts.other@example.com");
    const created = await createJobAlert("alerts.owner@example.com", alert("q=洗碗"));
    if (created.status !== "created") throw new Error(created.status);
    const id = created.alert.id;

    expect(await updateJobAlert("alerts.other@example.com", id, { name: "抢走" })).toBe(false);
    expect(await deleteJobAlert("alerts.other@example.com", id)).toBe(false);
    expect(await updateJobAlert("alerts.owner@example.com", id, { name: "洗碗工", paused: true })).toBe(true);
    expect(await listJobAlerts("alerts.owner@example.com")).toMatchObject([{ id, name: "洗碗工", paused: true }]);
    expect(await deleteJobAlert("alerts.owner@example.com", id)).toBe(true);
    expect(await listJobAlerts("alerts.owner@example.com")).toEqual([]);
  });

  it("tells each matching account about a new job once, never the business that posted it", async () => {
    const query = normalizeAlertQuery("q=匹配一次", "NZ");
    for (const email of ["match.a@example.com", "match.b@example.com", "match.paused@example.com"]) {
      await ensureAccount(email);
      await createJobAlert(email, alert(query, "第一个"), NOW);
    }
    await createJobAlert("match.a@example.com", alert(normalizeAlertQuery("q=匹配", "NZ"), "第二个"), NOW); // matches too
    await createJobAlert("match.b@example.com", alert("q=别的", "不匹配"), NOW);
    const [paused] = await listJobAlerts("match.paused@example.com");
    await updateJobAlert("match.paused@example.com", paused.id, { paused: true });
    // The account that owns e1 has an alert that matches its own job.
    await openEmployerIdentity("match.owner@example.com", "e1");
    await createJobAlert("match.owner@example.com", alert(query), NOW);

    const job = await newJob({ titleZh: "匹配一次的职位", descriptionZh: "匹配一次" });
    expect((await matchJobAlerts(job, NOW)).sort()).toEqual(["match.a@example.com", "match.b@example.com"]);
    expect(await matchJobAlerts(job, NOW)).toEqual([]); // the same job going live again
    expect(await listJobAlertHits("match.a@example.com")).toEqual([
      { email: "match.a@example.com", jobId: job.id, alertName: "第一个", createdAt: NOW.toISOString() },
    ]);
    expect(await listJobAlertHits("match.paused@example.com")).toEqual([]);
    expect(await listJobAlertHits("match.owner@example.com")).toEqual([]);
  });

  it("only matches jobs that are open, in the alert's market and filter", async () => {
    await ensureAccount("match.filter@example.com");
    await createJobAlert("match.filter@example.com", alert("industry=cleaning&q=筛选测试"), NOW);
    const wrongIndustry = await newJob({ industry: "hospitality", descriptionZh: "筛选测试" });
    const pending = await newJob({ industry: "cleaning", descriptionZh: "筛选测试", status: "pending_review" });
    const closed = await newJob({ industry: "cleaning", descriptionZh: "筛选测试", expiresAt: "2026-10-01T00:00:00Z" });
    for (const job of [wrongIndustry, pending, closed]) expect(await matchJobAlerts(job, NOW)).toEqual([]);
    const right = await newJob({ industry: "cleaning", descriptionZh: "筛选测试" });
    expect(await matchJobAlerts(right, NOW)).toEqual(["match.filter@example.com"]);
  });
});
