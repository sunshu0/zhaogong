import { describe, expect, it } from "vitest";
import { describeAction, groupOpenReports } from "@/app/admin/moderation";
import type { ModerationLogEntry, Report } from "@/lib/types";

const report = (id: string, jobId: string, createdAt: string, status: Report["status"] = "open", reason: Report["reason"] = "fake_job"): Report => ({
  id,
  jobId,
  reason,
  createdAt,
  status,
});

describe("groupOpenReports", () => {
  it("groups open reports by job, most reported first, then the newest", () => {
    const groups = groupOpenReports([
      report("r1", "j1", "2026-10-12T01:00:00Z"),
      report("r2", "j2", "2026-10-12T02:00:00Z"),
      report("r3", "j1", "2026-10-12T03:00:00Z", "open", "charges_fee"),
      report("r4", "j3", "2026-10-12T04:00:00Z", "dismissed"),
      report("r5", "j4", "2026-10-12T05:00:00Z"),
    ]);
    expect(groups.map((g) => g.jobId)).toEqual(["j1", "j4", "j2"]);
    expect(groups[0].reports.map((r) => r.id)).toEqual(["r3", "r1"]);
  });
});

describe("describeAction", () => {
  const base = { id: "a1", at: "2026-10-12T01:00:00Z", jobTitle: "前厅服务员", employerName: "川味小馆" };

  it("says what was done to which job and why", () => {
    expect(describeAction({ ...base, action: "take_down", reasons: ["charges_fee", "charges_fee", "fake_job"] } as ModerationLogEntry)).toBe(
      "下架「前厅服务员」（川味小馆） · 举报：虚假职位、收押金 / 介绍费",
    );
    expect(describeAction({ ...base, action: "approve", rules: ["high_risk"] } as ModerationLogEntry)).toBe("审核通过「前厅服务员」（川味小馆） · 标记：高风险行业");
    expect(describeAction({ ...base, action: "dismiss", reasons: ["other"] } as ModerationLogEntry)).toBe("驳回对「前厅服务员」（川味小馆）的举报 · 举报：其他");
  });

  it("counts the jobs a ban took down", () => {
    expect(describeAction({ ...base, action: "ban", jobTitle: undefined, takenDown: 3 } as ModerationLogEntry)).toBe("封禁雇主「川味小馆」，下架 3 个职位");
  });
});
