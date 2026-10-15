// Known-evidence score of this repository against the user's scoring table (D:/dev/scoring-rubric.md), from git
// and the GitHub CLI. Prints a markdown report: raw data, how it was counted, points. Anything that could not be
// obtained scores 0, shows 无法取得 and is listed under 限制说明.
//
//   node scripts/score.mjs [--ref origin/main] [--repo owner/name] [--no-fetch]
//
// Git data is read from the ref (default origin/main, fetched first with its tags), not the working tree.
// Scoring rules: scripts/score-rules.mjs.
import { execFileSync } from "node:child_process";
import {
  ASSETS,
  RULES,
  apiInterfaceCount,
  ciStages,
  codeLines,
  composeServiceCount,
  countContributors,
  daysBetween,
  isBusinessFile,
  isDesignSource,
  isQualifiedMessage,
  isTestFile,
  scoreOf,
} from "./score-rules.mjs";

const args = process.argv.slice(2);
const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const ref = option("--ref") ?? "origin/main";
const limits = [];

function git(...a) {
  return execFileSync("git", a, { encoding: "utf8", maxBuffer: 1 << 28 });
}

/** Parsed JSON from `gh`, or null when gh is missing, not signed in, or the call fails. */
function gh(...a) {
  try {
    return JSON.parse(execFileSync("gh", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  } catch {
    return null;
  }
}

// ---- Git ----

if (!args.includes("--no-fetch")) {
  try {
    execFileSync("git", ["fetch", "--quiet", "--tags", "origin"], { stdio: "ignore" });
  } catch {
    limits.push("`git fetch origin` 失败，按本机已有的提交和 tag 计算。");
  }
}
const sha = git("rev-parse", "--short", ref).trim();

/** path → blob id of every file at the ref. */
const tree = new Map();
for (const entry of git("ls-tree", "-r", "-z", "--full-tree", ref).split("\0")) {
  const m = /^\d+ blob (\w+)\t(.+)$/s.exec(entry);
  if (m) tree.set(m[2], m[1]);
}
const paths = [...tree.keys()];

/** Contents of files at the ref, in one `git cat-file --batch`. */
function read(files) {
  const out = execFileSync("git", ["cat-file", "--batch"], {
    input: files.map((f) => tree.get(f)).join("\n") + "\n",
    maxBuffer: 1 << 28,
  });
  const texts = new Map();
  let pos = 0;
  for (const f of files) {
    const nl = out.indexOf(10, pos);
    const size = Number(out.subarray(pos, nl).toString().split(" ")[2]);
    texts.set(f, out.subarray(nl + 1, nl + 1 + size).toString("utf8"));
    pos = nl + 1 + size + 1;
  }
  return texts;
}

const businessFiles = paths.filter(isBusinessFile);
const testFiles = paths.filter(isTestFile);
const workflowFiles = paths.filter((p) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(p));
const composeFile = paths.find((p) => /^(docker-)?compose\.ya?ml$/.test(p));
const texts = read([
  ...businessFiles,
  ...testFiles,
  ...workflowFiles,
  ...[composeFile, "docs/api.md", "docs/prd.md", "package.json"].filter((f) => f && tree.has(f)),
]);
const lines = (files) => files.reduce((n, f) => n + codeLines(texts.get(f)), 0);
const businessLoc = lines(businessFiles);
const testLoc = lines(testFiles);

const commits = git("log", ref, "--no-merges", "--format=%aI%x1f%an%x1f%ae%x1f%s")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [date, name, email, subject] = line.split("\x1f");
    return { date, name, email, subject };
  });
const dates = commits.map((c) => c.date).sort((a, b) => Date.parse(a) - Date.parse(b));
const first = dates[0];
const last = dates.at(-1);
const months = new Set(dates.map((d) => d.slice(0, 7)));
const qualified = commits.filter((c) => isQualifiedMessage(c.subject)).length;
const tags = git("tag", "--list").split("\n").filter(Boolean).length;

// ---- GitHub ----

const repo =
  option("--repo") ??
  /github\.com[/:]([^/]+\/[^/]+?)(\.git)?$/.exec(git("remote", "get-url", "origin").trim())?.[1] ??
  null;
const onGitHub = (...a) => (repo ? gh(...a, "--repo", repo) : null);
const prs = onGitHub("pr", "list", "--state", "all", "--limit", "1000", "--json", "number,state");
const issues = onGitHub("issue", "list", "--state", "all", "--limit", "1000", "--json", "number,state");
const releases = onGitHub("release", "list", "--limit", "200", "--json", "tagName");
const workflows = onGitHub("workflow", "list", "--all", "--json", "name,path,state");
const successRuns = onGitHub("run", "list", "--status", "success", "--limit", "1000", "--json", "databaseId");
if (!repo) limits.push("origin 不是 GitHub 仓库，也没有给 `--repo`：PR、Issue、Release、CI 运行记录都无法取得。");
else if ([prs, issues, releases, workflows, successRuns].includes(null))
  limits.push(`部分 GitHub 数据无法取得（\`gh\` 没装、没登录或调用失败，仓库 ${repo}）。`);

const merged = prs && prs.filter((p) => p.state === "MERGED").length;

// ---- Report ----

const rows = [];
const fmt = (n) => n.toLocaleString("en-US");
const pct = (r) => `${(r * 100).toFixed(1)}%`;

function row(section, item, rule, value, data, max = RULES[rule].max) {
  const unknown = value === null || value === undefined;
  if (unknown) limits.push(`${item}：无法取得，计 0 分。`);
  rows.push({
    section,
    item,
    data: unknown ? `无法取得${data ? `（${data}）` : ""}` : data,
    points: scoreOf(rule, value),
    max,
  });
}
function asset(item, { points, evidence }) {
  rows.push({ section: "附加工程资产", item, data: evidence, points, max: 2 });
}

row("源码规模", "业务 LOC", "businessLoc", businessLoc, `${fmt(businessLoc)} 行（代码行，不含空行和整行注释）`);
row(
  "源码规模",
  "业务文件数",
  "businessFiles",
  businessFiles.length,
  `${businessFiles.length} 个（src/ 下，不含测试和 src/mock 演示数据）`,
);

row("Git 与迭代", "有效提交", "commits", commits.length, `${commits.length} 个（${ref} 上的非合并提交）`);
row("Git 与迭代", "有效 PR", "pullRequests", merged, prs && `已合并 ${merged} 个（共 ${prs.length} 个，未合并的不算）`);
const firstYear = first ? Number(first.slice(0, 4)) : null;
row("Git 与迭代", "首次开发时间", "firstYear", firstYear, first && `第一个提交 ${first.slice(0, 10)}`);
const span = first ? daysBetween(first, last) : null;
row("Git 与迭代", "开发跨度", "spanDays", span, first && `${span} 天（${first.slice(0, 10)} – ${last.slice(0, 10)}）`);
row("Git 与迭代", "活跃月", "activeMonths", months.size, `${months.size} 个（${[...months].join("、")}）`);
const rate = commits.length ? qualified / commits.length : null;
row(
  "Git 与迭代",
  "提交说明合格率",
  "messageRate",
  rate,
  rate !== null && `${pct(rate)}（${qualified} / ${commits.length}，标题至少 10 个字符且不是 fix、update 之类的空话）`,
);
const people = countContributors(commits);
row(
  "Git 与迭代",
  "贡献者",
  "contributors",
  people,
  `${people} 人（同名或同邮箱算一人，机器人不算；Co-Authored-By 不算）`,
);
row(
  "Git 与迭代",
  "Issue",
  "issues",
  issues && issues.length,
  issues && `${issues.length} 个（其中开着 ${issues.filter((i) => i.state === "OPEN").length} 个，不含 PR）`,
);

asset(
  "数据库",
  ASSETS.database({
    schema: tree.has("src/db/schema.ts"),
    migrations: paths.filter((p) => /^drizzle\/[^/]+\.sql$/.test(p)).length,
  }),
);
asset(
  "API",
  ASSETS.api({
    doc: tree.has("docs/api.md"),
    interfaces: tree.has("docs/api.md") ? apiInterfaceCount(texts.get("docs/api.md")) : 0,
  }),
);
asset(
  "架构",
  ASSETS.architecture({
    overview: tree.has("docs/architecture.md"),
    adrs: paths.filter((p) => /^docs\/adr\/\d{4}-[^/]+\.md$/.test(p)).length,
  }),
);
asset(
  "容器",
  ASSETS.container({
    dockerfile: tree.has("Dockerfile"),
    composeServices: composeFile ? composeServiceCount(texts.get(composeFile)) : 0,
  }),
);
const scripts = tree.has("package.json") ? (JSON.parse(texts.get("package.json")).scripts ?? {}) : {};
const stages = [...new Set(workflowFiles.flatMap((f) => ciStages(texts.get(f), scripts)))];
const states = workflows && workflows.map((w) => `${w.name} ${w.state}`).join("、");
const ci = ASSETS.ci({
  workflows: workflowFiles.length,
  stages,
  successfulRuns: successRuns && successRuns.length,
  state: states,
});
if (workflowFiles.length && !successRuns) limits.push("CI：运行记录无法取得，计 0 分。");
asset("CI/CD", ci);
asset(
  "版本演进",
  ASSETS.versions({ changelog: tree.has("CHANGELOG.md"), tags, releases: releases && releases.length }),
);
const productKinds = [
  tree.has("docs/prd.md") && "需求文档 docs/prd.md",
  tree.has("docs/brief.md") && "产品简介 docs/brief.md",
].filter(Boolean);
const requirements = tree.has("docs/prd.md") ? (texts.get("docs/prd.md").match(/^\*\*R-\d+/gm) ?? []).length : 0;
asset("产品资料", ASSETS.product({ kinds: productKinds, requirements }));
asset(
  "设计",
  ASSETS.design({
    spec: tree.has("docs/design-system.md"),
    sources: paths.filter(isDesignSource).length,
  }),
);
row(
  "附加工程资产",
  "测试文件",
  "testFiles",
  testFiles.length,
  `${testFiles.length} 个（*.test.* 单测和 *.spec.* 浏览器测试）`,
);
const share = businessLoc + testLoc ? testLoc / (businessLoc + testLoc) : null;
row(
  "附加工程资产",
  "测试占比",
  "testShare",
  share,
  share !== null && `${pct(share)}（测试代码 ${fmt(testLoc)} 行 / 业务加测试 ${fmt(businessLoc + testLoc)} 行）`,
);

const total = rows.reduce((n, r) => n + r.points, 0);
const out = [
  `# 已知证据得分：${total} / 100`,
  "",
  `${repo ?? "（无 GitHub 仓库）"}，\`${ref}\` = \`${sha}\`，${new Date().toLocaleString("zh-CN", { hour12: false })}（本机时间）统计。`,
  "",
  "| 类别 | 项 | 数据 | 得分 |",
  "| --- | --- | --- | --- |",
  ...rows.map((r) => `| ${r.section} | ${r.item} | ${r.data} | ${r.points} / ${r.max} |`),
  "",
  "## 限制说明",
  "",
  ...[
    ...limits,
    "有效提交只去掉了合并提交，没有逐个判断提交内容；有效 PR 按已合并的计。",
    "业务代码不含测试、`src/mock` 演示数据、`drizzle/` 生成的迁移、`scripts/`、`e2e/` 和配置。",
    "CI 只有在 GitHub 上有成功的运行才算有效；workflow 文件本身不计分。",
    "设计源文件：设计工具的文件（.fig、.sketch 等），以及 `docs/design/` 下用 HTML 或 SVG 做的样稿；截图和其他图片是导出物，不算。",
  ].map((l) => `- ${l}`),
];
console.log(out.join("\n"));
