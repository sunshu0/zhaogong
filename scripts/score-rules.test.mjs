import { describe, expect, it } from "vitest";
import {
  ASSETS,
  apiInterfaceCount,
  ciStages,
  codeLines,
  composeServiceCount,
  countContributors,
  daysBetween,
  isBusinessFile,
  isQualifiedMessage,
  isTestFile,
  scoreOf,
} from "./score-rules.mjs";

describe("thresholds", () => {
  it("business LOC: 0 scores 0, then each band from the table", () => {
    expect(
      [0, 1, 4999, 5000, 19999, 20000, 50000, 100000, 200000, 500000].map((n) => scoreOf("businessLoc", n)),
    ).toEqual([0, 2, 2, 5, 5, 9, 14, 18, 22, 24]);
  });

  it("business files: up to 50 still scores 1", () => {
    expect([0, 50, 51, 101, 200, 201, 301, 499, 500].map((n) => scoreOf("businessFiles", n))).toEqual([
      1, 1, 2, 3, 3, 4, 5, 5, 6,
    ]);
  });

  it("commits, PRs and issues", () => {
    expect([99, 100, 249, 250, 500, 1000].map((n) => scoreOf("commits", n))).toEqual([2, 5, 5, 8, 13, 15]);
    expect([0, 10, 11, 51, 101, 201, 500].map((n) => scoreOf("pullRequests", n))).toEqual([1, 1, 2, 5, 8, 11, 15]);
    expect([0, 1, 10, 11].map((n) => scoreOf("issues", n))).toEqual([0, 1, 1, 2]);
  });

  it("time: first year, span and active months", () => {
    expect([2022, 2023, 2024, 2025, 2026].map((y) => scoreOf("firstYear", y))).toEqual([5, 3, 3, 0, 0]);
    expect([29, 30, 89, 90, 180, 365].map((d) => scoreOf("spanDays", d))).toEqual([0, 1, 1, 2, 3, 4]);
    expect([2, 3, 6, 12].map((n) => scoreOf("activeMonths", n))).toEqual([0, 1, 2, 3]);
  });

  it("message rate, contributors and tests", () => {
    expect([0.29, 0.3, 0.5, 0.7].map((r) => scoreOf("messageRate", r))).toEqual([0, 1, 2, 3]);
    expect([1, 2, 4, 10].map((n) => scoreOf("contributors", n))).toEqual([0, 1, 2, 3]);
    expect([0, 1, 5, 6].map((n) => scoreOf("testFiles", n))).toEqual([0, 1, 1, 2]);
    expect([0.009, 0.01, 0.049, 0.05].map((r) => scoreOf("testShare", r))).toEqual([0, 1, 1, 2]);
  });

  it("a value that could not be obtained scores 0 — even where a known 0 scores 1", () => {
    expect(scoreOf("pullRequests", null)).toBe(0);
    expect(scoreOf("pullRequests", 0)).toBe(1);
  });
});

describe("what counts", () => {
  it("business files are source under src/ without tests and demo data", () => {
    expect(isBusinessFile("src/lib/data.ts")).toBe(true);
    expect(isBusinessFile("src/app/globals.css")).toBe(true);
    expect(isBusinessFile("src/lib/data.test.ts")).toBe(false);
    expect(isBusinessFile("src/mock/jobs.ts")).toBe(false);
    expect(isBusinessFile("e2e/browse.spec.ts")).toBe(false);
    expect(isBusinessFile("scripts/score.mjs")).toBe(false);
    expect(isBusinessFile("drizzle/0000_init.sql")).toBe(false);
    expect(isBusinessFile("src/app/icon.png")).toBe(false);
  });

  it("test files are unit tests and browser specs", () => {
    expect(isTestFile("src/lib/data.test.ts")).toBe(true);
    expect(isTestFile("e2e/employer/a11y.spec.ts")).toBe(true);
    expect(isTestFile("scripts/score-rules.test.mjs")).toBe(true);
    expect(isTestFile("e2e/helpers.ts")).toBe(false);
  });

  it("code lines skip blank and comment-only lines", () => {
    const text = [
      "// a comment",
      "/** Doc",
      " * more",
      " */",
      "const a = 1; // trailing comments keep the line",
      "",
      "   ",
      "{/* JSX comment */}",
      "<p>{a}</p>",
    ].join("\n");
    expect(codeLines(text)).toBe(2);
  });

  it("a qualified commit message says what changed", () => {
    expect(isQualifiedMessage("B12-1: one database statement at a time per server")).toBe(true);
    expect(isQualifiedMessage("聊天：交换联系方式时发起方先提供自己的资料")).toBe(true);
    expect(isQualifiedMessage("fix")).toBe(false);
    expect(isQualifiedMessage("wip")).toBe(false);
    expect(isQualifiedMessage("tweak css")).toBe(false);
  });

  it("days between two dates", () => {
    expect(daysBetween("2026-10-11T10:00:00+13:00", "2026-11-10T09:00:00+13:00")).toBe(29);
    expect(daysBetween("2026-10-11T10:00:00+13:00", "2026-11-10T10:00:00+13:00")).toBe(30);
  });

  it("one person with two emails or two spellings counts once; bots do not count", () => {
    expect(
      countContributors([
        { name: "Sun Shuo", email: "a@example.com" },
        { name: "Sun Shuo", email: "b@example.com" },
        { name: "sshuo", email: "B@example.com" },
        { name: "github-actions[bot]", email: "bot@example.com" },
      ]),
    ).toBe(1);
    expect(
      countContributors([
        { name: "A", email: "a@example.com" },
        { name: "B", email: "b@example.com" },
      ]),
    ).toBe(2);
  });

  it("compose services are the keys under services:", () => {
    const compose = [
      "services:",
      "  app:",
      "    build: .",
      "    ports:",
      "      - '3000:3000'",
      "",
      "  db:",
      "    image: x",
      "volumes:",
      "  db-data:",
    ].join("\n");
    expect(composeServiceCount(compose)).toBe(2);
  });

  it("CI stages follow npm scripts: `npm run check` is test and build", () => {
    const workflow = "steps:\n  - run: npm ci\n  - run: npm run check\n  - run: npm run test:e2e";
    const scripts = {
      check: "npm run test && npm run build",
      test: "vitest run",
      build: "next build",
      "test:e2e": "playwright test",
    };
    expect(ciStages(workflow, scripts)).toEqual(["测试", "构建"]);
    expect(ciStages("- run: npm run cf:deploy", { "cf:deploy": "opennextjs-cloudflare deploy" })).toEqual(["部署"]);
    expect(ciStages("- run: echo hi")).toEqual([]);
  });

  it("API interfaces are the documented function rows", () => {
    const md = [
      "| 函数 | 参数 | 成功 | 失败 |",
      "| --- | --- | --- | --- |",
      "| `signInAccount(email, code)` | 邮箱 | `{ ok: true }` | `{ ok: false, error }` |",
      "| `getMyJobs(email)` | | 本企业所有职位 | `[]` |",
      "| `/jobs` | 职位列表 | | |",
    ].join("\n");
    expect(apiInterfaceCount(md)).toBe(2);
  });
});

describe("assets", () => {
  it("CI counts only with a successful run on GitHub", () => {
    const stages = ["测试", "构建"];
    expect(ASSETS.ci({ workflows: 1, stages, successfulRuns: 0, state: "disabled_manually" }).points).toBe(0);
    expect(ASSETS.ci({ workflows: 1, stages, successfulRuns: null }).points).toBe(0);
    expect(ASSETS.ci({ workflows: 1, stages, successfulRuns: 3 }).points).toBe(2);
    expect(ASSETS.ci({ workflows: 1, stages: ["测试"], successfulRuns: 3 }).points).toBe(1);
  });

  it("versions: changelog plus tags = 2; Release unknown is shown as 无法取得", () => {
    expect(ASSETS.versions({ changelog: true, tags: 3, releases: 3 }).points).toBe(2);
    expect(ASSETS.versions({ changelog: false, tags: 1, releases: null }).points).toBe(0);
    expect(ASSETS.versions({ changelog: false, tags: 2, releases: null })).toEqual({
      points: 1,
      evidence: "CHANGELOG 无，tag 2 个，Release 无法取得 个",
    });
  });

  it("database, API, architecture, container, product and design levels", () => {
    expect(ASSETS.database({ schema: true, migrations: 2 }).points).toBe(2);
    expect(ASSETS.database({ schema: true, migrations: 0 }).points).toBe(1);
    expect(ASSETS.api({ doc: true, interfaces: 4 }).points).toBe(1);
    expect(ASSETS.api({ doc: true, interfaces: 5 }).points).toBe(2);
    expect(ASSETS.architecture({ overview: false, adrs: 3 }).points).toBe(2);
    expect(ASSETS.architecture({ overview: true, adrs: 0 }).points).toBe(1);
    expect(ASSETS.container({ dockerfile: true, composeServices: 1 }).points).toBe(1);
    expect(ASSETS.container({ dockerfile: true, composeServices: 2 }).points).toBe(2);
    expect(ASSETS.product({ kinds: ["需求文档"], requirements: 27 }).points).toBe(1);
    expect(ASSETS.product({ kinds: ["需求文档", "产品简介"], requirements: 27 }).points).toBe(2);
    expect(ASSETS.design({ spec: true, sources: 0 }).points).toBe(1);
    expect(ASSETS.design({ spec: true, sources: 1 }).points).toBe(2);
  });
});
