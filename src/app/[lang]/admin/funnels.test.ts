import { describe, expect, it } from "vitest";
import { funnelReport, shownCount, type Seen } from "@/app/[lang]/admin/funnels";

const DAY = "2026-10-20";

/** `n` visitors on `day` who each did `names`, as `lang` / `role`. */
function visitors(n: number, names: string[], extra: Partial<Seen> = {}, tag = "v"): Seen[] {
  return Array.from({ length: n }, (_, i) =>
    names.map((name) => ({ visitor: `${tag}${i}`, day: DAY, name, lang: "zh", role: "employer", ...extra }) as Seen),
  ).flat();
}

const post = (report: ReturnType<typeof funnelReport>) => report.funnels.find((f) => f.id === "post")!.steps;

describe("shownCount (#316)", () => {
  it("shows 0 and 5 or more as numbers, and 1-4 as few", () => {
    expect([0, 1, 4, 5, 12].map(shownCount)).toEqual([0, "few", "few", 5, 12]);
  });
});

describe("funnelReport (#316)", () => {
  it("counts each step's visitors among those who reached the step before, with the rate of the first step", () => {
    const rows = [
      ...visitors(10, ["post_view", "post_mode", "post_preview", "post_publish"], {}, "a"),
      ...visitors(5, ["post_view", "post_mode"], {}, "b"),
      ...visitors(5, ["post_view"], {}, "c"),
    ];
    const steps = post(funnelReport(rows, 7));
    expect(steps.map((s) => s.counts.all)).toEqual([20, 15, 10, 10]);
    expect(steps.map((s) => s.rates.all)).toEqual([null, 75, 50, 50]);
  });

  it("does not count a later step without the ones before it (the same visitor and day)", () => {
    const rows = [...visitors(6, ["post_view"], {}, "a"), ...visitors(6, ["post_publish"], {}, "b")];
    expect(post(funnelReport(rows, 7)).map((s) => s.counts.all)).toEqual([6, 0, 0, 0]);
  });

  it("joins steps within a day only: the same visitor key on two days is two visitor-days", () => {
    const rows: Seen[] = [
      ...visitors(5, ["post_view"]),
      ...visitors(5, ["post_mode"]).map((r) => ({ ...r, day: "2026-10-21" })),
    ];
    expect(post(funnelReport(rows, 7)).map((s) => s.counts.all)).toEqual([5, 0, 0, 0]);
  });

  it("counts a visitor once a step, whichever of the step's events, and however often", () => {
    const rows = visitors(5, ["home_view", "jobs_list_view", "job_view", "job_view", "chat_start", "chat_start"]);
    const seek = funnelReport(rows, 7).funnels.find((f) => f.id === "seek")!.steps;
    expect(seek.map((s) => s.counts.all)).toEqual([5, 5, 5]);
  });

  it("shows 1-4 as few, and no rate where a count is under 5", () => {
    const rows = [...visitors(8, ["post_view", "post_mode"], {}, "a"), ...visitors(3, ["post_view"], {}, "b")];
    const steps = post(funnelReport(rows, 30));
    expect(steps[0].counts.all).toBe(11);
    expect(steps[1].counts.all).toBe(8);
    expect(steps[1].rates.all).toBe(73);
    const few = post(funnelReport(visitors(4, ["post_view", "post_mode"]), 30));
    expect(few.map((s) => s.counts.all)).toEqual(["few", "few", 0, 0]);
    expect(few[1].rates.all).toBeNull();
  });

  it("splits by the language and identity of a visitor-day's first event", () => {
    const rows = [
      ...visitors(6, ["post_view"], { lang: "en", role: "employer" }, "a"),
      ...visitors(2, ["post_view"], { lang: "zh", role: "seeker" }, "b"),
    ];
    const first = post(funnelReport(rows, 7))[0].counts;
    expect(first).toMatchObject({ all: 8, en: 6, zh: "few", employer: 6, seeker: "few", out: 0 });
  });

  it("counts the two single events by visitor-day", () => {
    const rows = [...visitors(5, ["applicants_view", "applicants_view"]), ...visitors(1, ["jobs_search"], {}, "s")];
    const singles = Object.fromEntries(funnelReport(rows, 7).singles.map((s) => [s.name, s.counts.all]));
    expect(singles).toEqual({ jobs_search: "few", applicants_view: 5 });
  });
});
