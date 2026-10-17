// Performance budget (#169): each route's first-load JavaScript, gzip-compressed, against scripts/perf-budget.json.
// Run after a build (npm run build, or npm run e2e:build for the test build in .next-e2e):
//
//   node scripts/perf-budget.mjs [--dir .next] [--write]
//
// Prints every route, heaviest first, and exits 1 if one is over its budget. --write sets the budgets from this
// build instead (measured size + 12%); only when a page grew on purpose, and say why in the PR.
// How it is measured and what to do when a route is over: docs/performance-budget.md. Rules: perf-budget-rules.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { checkBudgets, makeBudgets, routeSizes } from "./perf-budget-rules.mjs";

const args = process.argv.slice(2);
const dir = args.includes("--dir") ? args[args.indexOf("--dir") + 1] : ".next";
const budgetFile = path.join(import.meta.dirname, "perf-budget.json");

let stats;
try {
  stats = JSON.parse(readFileSync(path.join(dir, "diagnostics", "route-bundle-stats.json"), "utf8"));
} catch {
  console.error(
    `没有找到 ${dir}/diagnostics/route-bundle-stats.json：先构建（npm run build），或用 --dir 指向构建目录。`,
  );
  process.exit(2);
}
// The stats name chunks from the project folder (".next/static/chunks/…"), the one the build directory is in.
const project = path.dirname(path.resolve(dir));
const sizeOf = (chunk) => gzipSync(readFileSync(path.join(project, chunk))).length;
const sizes = routeSizes(stats, sizeOf);

if (args.includes("--write")) {
  const budgets = makeBudgets(sizes);
  writeFileSync(budgetFile, JSON.stringify(budgets, null, 2) + "\n");
  console.log(
    `写好了 ${Object.keys(budgets.routes).length} 个路由的预算（实测 + ${budgets.margin * 100}%），${budgetFile}`,
  );
  process.exit(0);
}

const budgets = JSON.parse(readFileSync(budgetFile, "utf8"));
const rows = checkBudgets(sizes, budgets);
console.log("| 路由 | 首屏 JS（gzip） | 预算 | |\n| --- | --- | --- | --- |");
for (const r of rows) {
  const note = r.over ? "**超了**" : r.unbudgeted ? "未设预算，按默认" : "";
  console.log(`| \`${r.route}\` | ${r.kb} KB | ${r.limitKb} KB | ${note} |`);
}
const over = rows.filter((r) => r.over);
if (over.length) {
  console.error(
    `\n${over.length} 个路由超了预算：${over.map((r) => r.route).join("、")}。怎么办见 docs/performance-budget.md。`,
  );
  process.exit(1);
}
console.log(`\n${rows.length} 个路由都在预算内。`);
