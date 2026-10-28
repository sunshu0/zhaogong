// The interaction budget (#418, ADR 0049): runs perf/inp.spec.ts (five main presses on a phone, CPU 4× slower)
// and prints each press's median and worst against 200 ms, as perf-budget.mjs prints sizes. Over the budget is only
// marked: the exit code is 0 unless the presses could not be made (the run itself failed, 1) or read (2).
//
//   npm run e2e:build
//   E2E_PORT=8705 npm run perf:inp      (Playwright owns the server; the port must be free)
//
// INP_RUNS sets how many times each press is made (default 5).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { formatTable, parseRuns, summarize, validateReport } from "./perf-inp-rules.mjs";

let requestedRuns;
try {
  requestedRuns = parseRuns(process.env.INP_RUNS);
  if (process.env.E2E_SERVER && process.env.E2E_SERVER !== "start") {
    throw new Error("INP only measures the production e2e build; E2E_SERVER must be start.");
  }
} catch (error) {
  console.error(error.message);
  process.exit(2);
}

const OUT = "test-results/inp.json";
rmSync(OUT, { force: true });

const started = Date.now();
const run = spawnSync(
  process.execPath,
  [resolve("node_modules/@playwright/test/cli.js"), "test", "--config", "playwright.inp.config.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, E2E_SERVER: "start", INP_OUT: OUT },
  },
);
const seconds = Math.round((Date.now() - started) / 1000);

if (run.error || run.signal) {
  console.error(`\nINP test process failed: ${run.error?.message || run.signal}`);
  process.exit(1);
}

if (!existsSync(OUT)) {
  console.error(`\nNo samples (${OUT}): the presses could not be made. See the output above.`);
  process.exit(2);
}
let report;
try {
  report = validateReport(JSON.parse(readFileSync(OUT, "utf8")), requestedRuns);
} catch (error) {
  console.error(`\nInvalid INP report (${OUT}): ${error.message}`);
  process.exit(2);
}
const { runs, cpuSlowdown, presses } = report;
console.log(`\n手机 375 px，CPU 慢 ${cpuSlowdown} 倍，每处 ${runs} 次，用了 ${seconds} 秒。\n`);
console.log(formatTable(summarize(presses)));
const censored = presses
  .flatMap((press) => press.measurements)
  .filter((measurement) => measurement.status === "below-threshold").length;
console.log(`\n${censored} 个样本低于 Event Timing 的 16 ms 门槛，按校准后的上界记录；原始证据在 ${OUT}。`);
process.exit(run.status === 0 ? 0 : 1);
