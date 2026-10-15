// The user's project scoring table (D:/dev/scoring-rubric.md, 100 points) as pure functions, so the thresholds
// and the counting rules can be tested without git or GitHub. A value that could not be obtained is `null`: it
// scores 0 but is reported as 无法取得, which is not the same as a known 0. Used by scripts/score.mjs.

/** Points for `value` from ascending [minimum, points] steps; below the first step scores `below`. */
function step(value, steps, below = 0) {
  let points = below;
  for (const [min, p] of steps) if (value >= min) points = p;
  return points;
}

export const RULES = {
  businessLoc: {
    max: 24,
    score: (n) =>
      n === 0
        ? 0
        : step(n, [
            [1, 2],
            [5000, 5],
            [20000, 9],
            [50000, 14],
            [100000, 18],
            [200000, 22],
            [500000, 24],
          ]),
  },
  businessFiles: {
    max: 6,
    score: (n) =>
      step(n, [
        [0, 1],
        [51, 2],
        [101, 3],
        [201, 4],
        [301, 5],
        [500, 6],
      ]),
  },
  commits: {
    max: 15,
    score: (n) =>
      step(n, [
        [0, 2],
        [100, 5],
        [250, 8],
        [500, 13],
        [1000, 15],
      ]),
  },
  pullRequests: {
    max: 15,
    score: (n) =>
      step(n, [
        [0, 1],
        [11, 2],
        [51, 5],
        [101, 8],
        [201, 11],
        [500, 15],
      ]),
  },
  firstYear: { max: 5, score: (year) => (year < 2023 ? 5 : year <= 2024 ? 3 : 0) },
  spanDays: {
    max: 4,
    score: (d) =>
      step(d, [
        [30, 1],
        [90, 2],
        [180, 3],
        [365, 4],
      ]),
  },
  activeMonths: {
    max: 3,
    score: (n) =>
      step(n, [
        [3, 1],
        [6, 2],
        [12, 3],
      ]),
  },
  messageRate: {
    max: 3,
    score: (r) =>
      step(r, [
        [0.3, 1],
        [0.5, 2],
        [0.7, 3],
      ]),
  },
  contributors: {
    max: 3,
    score: (n) =>
      step(n, [
        [2, 1],
        [4, 2],
        [10, 3],
      ]),
  },
  issues: {
    max: 2,
    score: (n) =>
      step(n, [
        [1, 1],
        [11, 2],
      ]),
  },
  testFiles: {
    max: 2,
    score: (n) =>
      step(n, [
        [1, 1],
        [6, 2],
      ]),
  },
  testShare: {
    max: 2,
    score: (r) =>
      step(r, [
        [0.01, 1],
        [0.05, 2],
      ]),
  },
};

/** Score of a measured value; null (无法取得) scores 0. */
export function scoreOf(rule, value) {
  return value === null || value === undefined ? 0 : RULES[rule].score(value);
}

const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/;
const TEST = /\.(test|spec)\.[cm]?[tj]sx?$/;

/** A test file anywhere in the repository: unit tests (*.test.*) and browser tests (*.spec.*). */
export function isTestFile(path) {
  return TEST.test(path);
}

/**
 * Business code: source under src/, without tests and without the demo data in src/mock. Scripts, browser
 * tests, configuration, docs and the generated migrations in drizzle/ are not counted.
 */
export function isBusinessFile(path) {
  return path.startsWith("src/") && SOURCE.test(path) && !isTestFile(path) && !path.startsWith("src/mock/");
}

/** Lines that hold code: not blank and not only a comment (`//`, `/*`, `*`, `*\/`, `{/* … *\/}`). */
export function codeLines(text) {
  let n = 0;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;
    if (/^\{\/\*.*\*\/\}$/.test(line)) continue;
    n++;
  }
  return n;
}

const GENERIC = /^(update|updates|fix|fixes|wip|changes?|misc|tmp|test|\.|-)$/i;

/** A commit message that says what changed: a subject of at least 10 characters that is not a generic word. */
export function isQualifiedMessage(subject) {
  const s = subject.trim();
  return s.length >= 10 && !GENERIC.test(s);
}

/** Whole days between two ISO dates. */
export function daysBetween(first, last) {
  return Math.floor((Date.parse(last) - Date.parse(first)) / 86_400_000);
}

/**
 * People behind the commits: authors with the same email or the same name count once (one person often
 * commits from two machines), and bots (`name[bot]`) do not count.
 */
export function countContributors(authors) {
  const people = [];
  for (const { name, email } of authors) {
    if (/\[bot\]$/i.test(name)) continue;
    const n = name.trim().toLowerCase();
    const e = email.trim().toLowerCase();
    const matches = people.filter((p) => p.names.has(n) || p.emails.has(e));
    const merged = { names: new Set([n]), emails: new Set([e]) };
    for (const p of matches) {
      p.names.forEach((x) => merged.names.add(x));
      p.emails.forEach((x) => merged.emails.add(x));
      people.splice(people.indexOf(p), 1);
    }
    people.push(merged);
  }
  return people.length;
}

/** Top-level services in a docker-compose file (keys indented once under `services:`). */
export function composeServiceCount(text) {
  let inServices = false;
  let n = 0;
  for (const line of text.split("\n")) {
    if (/^\S/.test(line)) inServices = /^services:\s*$/.test(line);
    else if (inServices && /^ {2}[\w.-]+:\s*$/.test(line)) n++;
  }
  return n;
}

/**
 * Stages a workflow covers among test, build, release and deploy. `npm run x` steps are expanded through the
 * package.json scripts, so `npm run check` counts as the test and build it runs.
 */
export function ciStages(workflow, scripts = {}) {
  let text = workflow;
  const seen = new Set();
  for (let more = true; more;) {
    more = false;
    for (const [, name] of text.matchAll(/npm run ([\w:.-]+)/g)) {
      if (seen.has(name) || !scripts[name]) continue;
      seen.add(name);
      text += `\n${scripts[name]}`;
      more = true;
    }
  }
  const stages = [];
  if (/\b(vitest|playwright|jest|npm (run )?test)\b/.test(text)) stages.push("测试");
  if (/\b(next build|npm run build|docker build)\b/.test(text)) stages.push("构建");
  if (/\b(gh release|npm publish|softprops\/action-gh-release)\b/.test(text)) stages.push("发布");
  if (/\b(wrangler deploy|opennextjs-cloudflare deploy|npm run cf:deploy)\b/.test(text)) stages.push("部署");
  return stages;
}

/** Interfaces in docs/api.md: table rows that document a function with its parameters, success and failure. */
export function apiInterfaceCount(markdown) {
  return markdown.split("\n").filter((line) => /^\| `[\w$]+\(.*\)` \|(.*\|){3}\s*$/.test(line)).length;
}

const DESIGN_TOOL = /\.(fig|sketch|xd|pen|penpot)$/i;

/**
 * A design source file: a design tool's file anywhere, or a mockup made as HTML or SVG under docs/design/ (the
 * file the design was made in, which opens and can be edited). Screenshots and other images are exports of a
 * design, not its source, and do not count.
 */
export function isDesignSource(path) {
  return DESIGN_TOOL.test(path) || (path.startsWith("docs/design/") && /\.(html?|svg)$/i.test(path));
}

/** Asset levels (0–2) from what is in the repository; each returns { points, evidence }. */
export const ASSETS = {
  /** Schema plus versioned migrations = 2; either = 1. */
  database({ schema, migrations }) {
    const points = schema && migrations > 0 ? 2 : schema || migrations > 0 ? 1 : 0;
    return { points, evidence: `表结构 ${schema ? "有" : "无"}，迁移 ${migrations} 个` };
  },
  /** A structured API document = 1; with at least 5 interfaces described with request and response = 2. */
  api({ doc, interfaces }) {
    const points = !doc ? 0 : interfaces >= 5 ? 2 : 1;
    return { points, evidence: doc ? `docs/api.md，${interfaces} 个接口写明参数、成功和失败` : "没有 API 文档" };
  },
  /** One kind of architecture material = 1; two kinds or at least 3 ADRs = 2. */
  architecture({ overview, adrs }) {
    const kinds = (overview ? 1 : 0) + (adrs > 0 ? 1 : 0);
    const points = kinds >= 2 || adrs >= 3 ? 2 : kinds;
    return { points, evidence: `架构说明 ${overview ? "有" : "无"}，ADR ${adrs} 篇` };
  },
  /** An image or an orchestration file = 1; image plus a multi-service orchestration = 2. */
  container({ dockerfile, composeServices }) {
    const points = dockerfile && composeServices >= 2 ? 2 : dockerfile || composeServices > 0 ? 1 : 0;
    return { points, evidence: `Dockerfile ${dockerfile ? "有" : "无"}，compose 服务 ${composeServices} 个` };
  },
  /**
   * A working workflow = 1; covering at least two of test, build, release, deploy = 2. "Working" needs a
   * successful run on GitHub: a file alone, or a workflow that never ran, does not count.
   */
  ci({ workflows, stages, successfulRuns, state }) {
    if (!workflows) return { points: 0, evidence: "没有 workflow" };
    const covers = `覆盖 ${stages.join("、") || "无"}`;
    const status = state ? `，状态 ${state}` : "";
    if (successfulRuns === null)
      return { points: 0, evidence: `workflow ${workflows} 个，${covers}，运行记录无法取得` };
    if (successfulRuns === 0)
      return { points: 0, evidence: `workflow ${workflows} 个，${covers}${status}，没有成功的运行` };
    return {
      points: stages.length >= 2 ? 2 : 1,
      evidence: `workflow ${workflows} 个，${covers}${status}，成功运行 ${successfulRuns} 次`,
    };
  },
  /** A changelog or at least 2 tags/releases = 1; changelog plus tags/releases, or at least 5 releases = 2. */
  versions({ changelog, tags, releases }) {
    const tagged = Math.max(tags, releases ?? 0);
    const points = (changelog && tagged > 0) || (releases ?? 0) >= 5 ? 2 : changelog || tagged >= 2 ? 1 : 0;
    return {
      points,
      evidence: `CHANGELOG ${changelog ? "有" : "无"}，tag ${tags} 个，Release ${releases ?? "无法取得"} 个`,
    };
  },
  /**
   * One kind of product material = 1; two kinds = 2. Requirement items in a markdown PRD are shown but not
   * counted as a "structured export" (that means an export from a requirements tool).
   */
  product({ kinds, requirements }) {
    const points = Math.min(kinds.length, 2);
    return { points, evidence: `${kinds.join("、") || "没有产品资料"}；PRD 需求项 ${requirements} 个` };
  },
  /** Design source files or a design spec = 1; source files plus spec, or source files for several pages = 2. */
  design({ spec, sources }) {
    const points = (spec && sources > 0) || sources >= 3 ? 2 : spec || sources > 0 ? 1 : 0;
    return { points, evidence: `设计规范 ${spec ? "有" : "无"}，设计源文件 ${sources} 个` };
  },
};
