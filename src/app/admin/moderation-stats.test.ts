import { describe, expect, it } from "vitest";
import {
  AI_DAYS,
  lastDays,
  lastWeeks,
  median,
  moderationStats,
  nzDay,
  waitZh,
  weekOf,
  type AiUsageEntry,
} from "@/app/admin/moderation-stats";
import type { Job, ModerationLogEntry, Report } from "@/lib/types";
import { MOCK_JOBS } from "@/mock/data";

// Friday 16 October 2026, 10:00 in Auckland (NZDT, UTC+13).
const NOW = Date.parse("2026-10-15T21:00:00.000Z");
const HOUR = 3_600_000;

const report = (patch: Partial<Report>): Report => ({
  id: "r",
  jobId: "j1",
  reason: "fake_job",
  createdAt: "2026-10-14T00:00:00.000Z",
  status: "open",
  ...patch,
});
const logged = (patch: Partial<ModerationLogEntry>): ModerationLogEntry => ({
  id: "l",
  at: "2026-10-14T00:00:00.000Z",
  action: "take_down",
  ...patch,
});

describe("weeks in New Zealand (#70)", () => {
  it("counts days and weeks in Auckland time, Monday to Sunday", () => {
    expect(nzDay(Date.parse("2026-10-11T11:30:00.000Z"))).toBe("2026-10-12"); // Monday 00:30 in Auckland
    expect(weekOf("2026-10-12")).toBe("2026-10-12");
    expect(weekOf("2026-10-18")).toBe("2026-10-12"); // Sunday
    expect(weekOf("2026-10-11")).toBe("2026-10-05");
    expect(lastWeeks(NOW, 3)).toEqual(["2026-10-12", "2026-10-05", "2026-09-28"]);
    expect(lastWeeks(NOW)).toHaveLength(8);
  });

  it("takes the middle value, or the mean of the two middle ones", () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 10])).toBe(3.5);
  });

  it("says a wait in words", () => {
    expect(waitZh(20_000)).toBe("不到 1 分钟");
    expect(waitZh(25 * 60_000)).toBe("25 分钟");
    expect(waitZh(3 * HOUR + 59 * 60_000)).toBe("3 小时");
    expect(waitZh(48 * HOUR)).toBe("2 天");
    expect(waitZh(53 * HOUR)).toBe("2 天 5 小时");
  });
});

describe("moderationStats (#70)", () => {
  it("shows what waits now: jobs to review, open reports, and the oldest of each", () => {
    const jobs: Job[] = [
      { ...MOCK_JOBS[0], id: "a", status: "pending_review", postedAt: "2026-10-15T00:00:00.000Z" },
      { ...MOCK_JOBS[0], id: "b", status: "pending_review", postedAt: "2026-10-13T00:00:00.000Z" },
      { ...MOCK_JOBS[0], id: "c", status: "active", postedAt: "2026-10-01T00:00:00.000Z" },
    ];
    const reports = [
      report({ id: "r1", createdAt: "2026-10-15T08:00:00.000Z" }),
      report({ id: "r2", createdAt: "2026-10-10T08:00:00.000Z" }),
      report({ id: "r3", createdAt: "2026-10-01T08:00:00.000Z", status: "dismissed" }),
    ];
    const stats = moderationStats({ jobs, reports, log: [] }, NOW);
    expect(stats).toMatchObject({
      at: NOW,
      pendingJobs: 2,
      openReports: 2,
      oldestPendingJobAt: "2026-10-13T00:00:00.000Z",
      oldestOpenReportAt: "2026-10-10T08:00:00.000Z",
    });
    expect(moderationStats({ jobs: [], reports: [], log: [] }, NOW)).toMatchObject({
      pendingJobs: 0,
      openReports: 0,
      oldestPendingJobAt: undefined,
      oldestOpenReportAt: undefined,
    });
  });

  it("counts each week's reports, closings with their median time, take-downs and bans", () => {
    const reports = [
      // Made last week, closed this week after 3 days.
      report({ createdAt: "2026-10-09T00:00:00.000Z", status: "actioned", handledAt: "2026-10-12T00:00:00.000Z" }),
      // Made and closed this week: 2 and 6 hours.
      report({ createdAt: "2026-10-13T00:00:00.000Z", status: "dismissed", handledAt: "2026-10-13T02:00:00.000Z" }),
      report({ createdAt: "2026-10-13T00:00:00.000Z", status: "actioned", handledAt: "2026-10-13T06:00:00.000Z" }),
      // Still open.
      report({ createdAt: "2026-10-14T00:00:00.000Z" }),
      // Closed before closing times were kept.
      report({ createdAt: "2026-10-14T00:00:00.000Z", status: "dismissed" }),
      // Older than eight weeks.
      report({ createdAt: "2026-01-01T00:00:00.000Z", status: "actioned", handledAt: "2026-01-02T00:00:00.000Z" }),
    ];
    const log = [
      logged({ action: "take_down", moderator: "a@example.com" }),
      logged({ action: "ban", takenDown: 3, moderator: "b@example.com" }),
      logged({ action: "dismiss", moderator: "a@example.com" }),
      logged({ action: "approve" }), // from before #60: nobody named
      logged({ action: "verify_approve", moderator: "a@example.com" }), // 企业验证 (#78): not a take-down
      logged({ action: "verify_reject", moderator: "a@example.com" }),
      logged({ action: "take_down", at: "2026-10-06T00:00:00.000Z", moderator: "b@example.com" }),
      logged({ action: "approve", at: "2026-01-06T00:00:00.000Z", moderator: "c@example.com" }), // too old
    ];
    const { weeks, untimed, byModerator } = moderationStats({ jobs: [], reports, log }, NOW);
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toEqual({
      week: "2026-10-12",
      reported: 4,
      handled: 3,
      medianHandleMs: 6 * HOUR,
      takenDown: 4,
      banned: 1,
    });
    expect(weeks[1]).toEqual({
      week: "2026-10-05",
      reported: 1,
      handled: 0,
      medianHandleMs: null,
      takenDown: 1,
      banned: 0,
    });
    expect(untimed).toBe(1);
    // Per moderator over the eight weeks (#60): most first, the unnamed old entries last.
    expect(byModerator).toEqual([
      { moderator: "a@example.com", approve: 0, takeDown: 1, dismiss: 1, ban: 0, verify: 2, external: 0, total: 4 },
      { moderator: "b@example.com", approve: 0, takeDown: 1, dismiss: 0, ban: 1, verify: 0, external: 0, total: 2 },
      { moderator: undefined, approve: 1, takeDown: 0, dismiss: 0, ban: 0, verify: 0, external: 0, total: 1 },
    ]);
  });

  it("counts external jobs waiting and moderators' external decisions (#112)", () => {
    const log: ModerationLogEntry[] = [
      { id: "x1", at: "2026-10-15T01:00:00.000Z", action: "external_approve", moderator: "a@example.com" },
      { id: "x2", at: "2026-10-15T02:00:00.000Z", action: "external_stop", moderator: "a@example.com" },
    ];
    const stats = moderationStats(
      {
        jobs: [],
        reports: [],
        log,
        externalPending: [{ firstSeenAt: "2026-10-14T00:00:00.000Z" }, { firstSeenAt: "2026-10-13T00:00:00.000Z" }],
      },
      NOW,
    );
    expect(stats).toMatchObject({ pendingExternal: 2, oldestPendingExternalAt: "2026-10-13T00:00:00.000Z" });
    expect(stats.byModerator).toEqual([
      { moderator: "a@example.com", approve: 0, takeDown: 0, dismiss: 0, ban: 0, verify: 0, external: 2, total: 2 },
    ]);
  });
});

describe("AI 发帖用量 (#102)", () => {
  const call = (at: string, result: AiUsageEntry["result"] = "ok"): AiUsageEntry => ({
    at,
    input: 1000,
    output: 200,
    cacheRead: result === "ok" ? 800 : 0,
    cacheWrite: 0,
    result,
  });

  it("lists the last seven New Zealand days, today first", () => {
    expect(lastDays(NOW)).toEqual([
      "2026-10-16",
      "2026-10-15",
      "2026-10-14",
      "2026-10-13",
      "2026-10-12",
      "2026-10-11",
      "2026-10-10",
    ]);
  });

  it("counts calls, tokens and failures per day; turned-away calls apart; older days left out", () => {
    const { aiPosting } = moderationStats(
      {
        jobs: [],
        reports: [],
        log: [],
        aiUsage: [
          call("2026-10-15T20:00:00.000Z"), // 16 October, 09:00 in Auckland
          call("2026-10-15T20:30:00.000Z", "error"),
          call("2026-10-15T20:40:00.000Z", "limited"),
          call("2026-10-15T10:00:00.000Z", "refused"), // 15 October, 23:00
          call("2026-10-09T08:00:00.000Z"), // 9 October: eight days back
        ],
      },
      NOW,
    );
    expect(aiPosting.days).toHaveLength(AI_DAYS);
    expect(aiPosting.days[0]).toEqual({ day: "2026-10-16", calls: 2, tokens: 3200, failed: 1, limited: 1 });
    expect(aiPosting.days[1]).toEqual({ day: "2026-10-15", calls: 1, tokens: 1200, failed: 1, limited: 0 });
    expect(aiPosting.days.slice(2).every((d) => d.calls === 0 && d.limited === 0)).toBe(true);
    expect(aiPosting.total).toEqual({ day: "total", calls: 3, tokens: 4400, failed: 2, limited: 1 });
  });

  it("is all zeros without any calls", () => {
    const { aiPosting } = moderationStats({ jobs: [], reports: [], log: [] }, NOW);
    expect(aiPosting.total).toEqual({ day: "total", calls: 0, tokens: 0, failed: 0, limited: 0 });
  });
});
