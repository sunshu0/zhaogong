import { describe, expect, it } from "vitest";
import { liveTwins, normalizeTitle } from "@/components/employer/job-twins";

const NOW = Date.UTC(2026, 9, 18);
const day = 86_400_000;
const job = (id: string, titleZh: string, status: "active" | "pending_review" | "expired" | "removed", days = 10) => ({
  id,
  titleZh,
  status,
  expiresAt: new Date(NOW + days * day).toISOString(),
});

describe("重复职位提醒 (#196)", () => {
  it("reads titles the same without spaces, full-width letters or case", () => {
    expect(normalizeTitle(" 前厅 服务员 ")).toBe("前厅服务员");
    expect(normalizeTitle("ＫＴＶ Barista")).toBe(normalizeTitle("ktv barista"));
  });

  it("finds live and waiting jobs with the same title, not ended or removed ones", () => {
    const jobs = [
      job("j1", "前厅服务员", "active"),
      job("j2", "前厅 服务员", "pending_review"),
      job("j3", "前厅服务员", "active", -1),
      job("j4", "前厅服务员", "expired"),
      job("j5", "前厅服务员", "removed"),
      job("j6", "厨房帮工", "active"),
    ];
    expect(liveTwins(jobs, "前厅服务员", NOW).map((j) => j.id)).toEqual(["j1", "j2"]);
    expect(liveTwins(jobs, "  ", NOW)).toEqual([]);
  });
});
