import { describe, expect, it } from "vitest";
import {
  jobDays,
  jobNumbers,
  jobOfConversation,
  lastDays,
  nzDay,
  recordChatStart,
  recordJobView,
} from "@/db/job-stats";
import { database } from "@/db/ready";
import * as t from "@/db/schema";
import { createJob, recordContactView } from "@/lib/data";
import type { Job } from "@/lib/types";
import { MOCK_JOBS } from "@/mock/data";

async function newJob(): Promise<string> {
  const job: Partial<Job> = { ...MOCK_JOBS[0] };
  delete job.id;
  return (await createJob(job as Omit<Job, "id">)).id;
}

describe("New Zealand days", () => {
  it("names the day in Auckland, not UTC", () => {
    expect(nzDay(new Date("2026-10-16T12:30:00Z"))).toBe("2026-10-17"); // 01:30 NZDT
    expect(nzDay(new Date("2026-10-16T10:30:00Z"))).toBe("2026-10-16");
  });

  it("lists the last n days oldest first, across a daylight-saving change", () => {
    // NZ daylight saving started on 2026-09-27 (02:00 → 03:00).
    const days = lastDays(new Date("2026-09-28T03:00:00Z"), 3);
    expect(days).toEqual(["2026-09-26", "2026-09-27", "2026-09-28"]);
    expect(lastDays(new Date("2026-10-16T00:00:00Z"), 14)).toHaveLength(14);
  });
});

describe("recording (#55)", () => {
  it("counts a browser once a day per job", async () => {
    const job = await newJob();
    const morning = new Date("2026-10-15T20:00:00Z"); // 16 Oct, 09:00 NZ
    await recordJobView(job, "browser-a", morning);
    await recordJobView(job, "browser-a", new Date("2026-10-16T05:00:00Z")); // same NZ day
    await recordJobView(job, "browser-b", morning);
    await recordJobView(job, "browser-a", new Date("2026-10-16T12:00:00Z")); // 17 Oct NZ
    expect((await jobNumbers([job]))[job].views).toBe(3);
  });

  it("counts each job seeker who starts a chat once, whatever the case of the email", async () => {
    const job = await newJob();
    expect(await recordChatStart(job, "Asker@example.com")).toBe("counted");
    expect(await recordChatStart(job, "asker@example.com ")).toBe("already");
    expect(await recordChatStart(job, "second@example.com")).toBe("counted");
    expect((await jobNumbers([job]))[job].chats).toBe(2);
  });
});

describe("reading (#55)", () => {
  it("gives every job asked for its totals, zeros included, and nothing of other jobs", async () => {
    const [a, b] = [await newJob(), await newJob()];
    await recordJobView(a, "v1");
    await recordChatStart(a, "x@example.com");
    await recordContactView(a, "x@example.com");
    await recordContactView(a, "y@example.com");
    expect(await jobNumbers([a, b])).toEqual({
      [a]: { views: 1, chats: 1, contactViews: 2 },
      [b]: { views: 0, chats: 0, contactViews: 0 },
    });
    expect(await jobNumbers([])).toEqual({});
  });

  it("splits the last 14 days by New Zealand day, oldest first", async () => {
    const job = await newJob();
    const now = new Date("2026-10-16T03:00:00Z"); // 16 Oct, 16:00 NZ
    await recordJobView(job, "v1", now);
    await recordJobView(job, "v2", now);
    await recordJobView(job, "v1", new Date("2026-10-14T03:00:00Z"));
    await recordJobView(job, "v9", new Date("2026-09-01T03:00:00Z")); // outside the window
    await recordChatStart(job, "late@example.com", new Date("2026-10-15T12:00:00Z")); // 16 Oct 01:00 NZ
    const db = await database();
    await db.insert(t.contactViews).values([
      { jobId: job, viewerEmail: "c@example.com", viewedAt: "2026-10-15T10:00:00.000Z" }, // 15 Oct 23:00 NZ
      { jobId: job, viewerEmail: "d@example.com", viewedAt: "2026-09-01T10:00:00.000Z" },
    ]);

    const days = await jobDays(job, now);
    expect(days).toHaveLength(14);
    expect(days[0].day).toBe("2026-10-03");
    expect(days.at(-1)).toEqual({ day: "2026-10-16", views: 2, chats: 1, contactViews: 0 });
    expect(days.find((d) => d.day === "2026-10-15")).toEqual({
      day: "2026-10-15",
      views: 0,
      chats: 0,
      contactViews: 1,
    });
    expect(days.find((d) => d.day === "2026-10-14")?.views).toBe(1);
    expect(days.reduce((sum, d) => sum + d.views + d.chats + d.contactViews, 0)).toBe(5);
  });
});

describe("chats about a job", () => {
  it("reads the job from a chat opened on a job page, and nothing from other chats", () => {
    expect(jobOfConversation("employer:e3:j12")).toBe("j12");
    expect(jobOfConversation("north-tea")).toBeUndefined();
    expect(jobOfConversation("candidate:c1:j12")).toBeUndefined();
  });
});
