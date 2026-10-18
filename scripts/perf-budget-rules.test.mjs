import { describe, expect, it } from "vitest";
import { MARGIN, budgetKb, checkBudgets, makeBudgets, routeSizes, siteRoute } from "./perf-budget-rules.mjs";

const SIZES = { ".next/static/chunks/a.js": 1000, ".next/static/chunks/b.js": 2000, ".next/static/chunks/c.js": 500 };
const sizeOf = (path) => SIZES[path];

describe("routeSizes", () => {
  it("adds up each route's chunks once, whatever the path separator", () => {
    const stats = [
      { route: "/", firstLoadChunkPaths: [".next\\static\\chunks\\a.js", ".next\\static\\chunks\\b.js"] },
      {
        route: "/jobs",
        firstLoadChunkPaths: [".next/static/chunks/a.js", ".next\\static\\chunks\\a.js", ".next/static/chunks/c.js"],
      },
    ];
    expect(routeSizes(stats, sizeOf)).toEqual([
      { route: "/", bytes: 3000 },
      { route: "/jobs", bytes: 1500 },
    ]);
  });
});

describe("siteRoute", () => {
  it("drops the internal [lang] segment (Round 20), so budgets keep the addresses people see", () => {
    expect(siteRoute("/[lang]")).toBe("/");
    expect(siteRoute("/[lang]/jobs")).toBe("/jobs");
    expect(siteRoute("/[lang]/employer/jobs/[id]")).toBe("/employer/jobs/[id]");
    expect(siteRoute("/[lang]/_not-found")).toBe("/_not-found");
    expect(siteRoute("/_not-found")).toBe("/_not-found");
    expect(siteRoute("/api/dev/job-closing")).toBe("/api/dev/job-closing");
  });
});

describe("budgetKb", () => {
  it("adds the margin and rounds up to a whole KB", () => {
    expect(MARGIN).toBeGreaterThanOrEqual(0.1);
    expect(MARGIN).toBeLessThanOrEqual(0.15);
    expect(budgetKb(100 * 1024, 0.12)).toBe(112);
    expect(budgetKb(100 * 1024 + 1, 0.12)).toBe(113);
    expect(budgetKb(0)).toBe(0);
  });
});

describe("makeBudgets", () => {
  it("gives every route a budget, sorted by route, and the largest as the default for new routes", () => {
    const budgets = makeBudgets(
      [
        { route: "/jobs", bytes: 200 * 1024 },
        { route: "/", bytes: 100 * 1024 },
      ],
      0.1,
    );
    expect(budgets).toEqual({ margin: 0.1, defaultKb: 220, routes: { "/": 110, "/jobs": 220 } });
    expect(Object.keys(budgets.routes)).toEqual(["/", "/jobs"]);
  });
});

describe("checkBudgets", () => {
  const budgets = { margin: 0.12, defaultKb: 150, routes: { "/": 100, "/jobs": 150 } };

  it("passes a route at its budget and fails one a byte over, heaviest first", () => {
    expect(
      checkBudgets(
        [
          { route: "/", bytes: 100 * 1024 },
          { route: "/jobs", bytes: 150 * 1024 + 1 },
        ],
        budgets,
      ),
    ).toEqual([
      { route: "/jobs", kb: 150, limitKb: 150, over: true, unbudgeted: false },
      { route: "/", kb: 100, limitKb: 100, over: false, unbudgeted: false },
    ]);
  });

  it("holds a route the file does not list to the default", () => {
    const [light, heavy] = [
      { route: "/new", bytes: 140 * 1024 },
      { route: "/newer", bytes: 160 * 1024 },
    ];
    expect(checkBudgets([light], budgets)[0]).toMatchObject({ limitKb: 150, over: false, unbudgeted: true });
    expect(checkBudgets([heavy], budgets)[0]).toMatchObject({ limitKb: 150, over: true, unbudgeted: true });
  });
});
