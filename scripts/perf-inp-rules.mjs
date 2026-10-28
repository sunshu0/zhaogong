// Rules of the interaction budget (#418, ADR 0049): how long a press takes to show (INP, Interaction to Next Paint)
// at a few main presses on a phone, against 200 ms. The samples come from perf/inp.spec.ts (Event Timing entries,
// each press's longest); perf-inp.mjs reads them and prints the table. Only counted: over the budget is marked, not
// a failure. R2 permits a separate inp gate segment now, with numbers still advisory.

/** Google's "good" INP, which the 操作手感 plan takes for a phone (brief-B-13 T10). */
export const INP_BUDGET_MS = 200;

export const INP_PRESS_NAMES = Object.freeze([
  "职位列表点卡片",
  "详情页「立即沟通」",
  "聊天里发一条消息",
  "底部「更多」打开",
  "筛选弹层打开",
]);

/** An absent override uses five samples; an invalid override must never skip the measurement loops. */
export function parseRuns(value) {
  if (value === undefined) return 5;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error("INP_RUNS must be a positive decimal integer.");
  }
  return Number(value);
}

function validateSamples(samples) {
  if (
    !Array.isArray(samples) ||
    Array.from(samples).some((sample) => typeof sample !== "number" || !Number.isFinite(sample) || sample < 0)
  ) {
    throw new Error("INP samples must be finite, non-negative numbers.");
  }
}

const TARGET_EVENTS = ["pointerdown", "pointerup", "click"];
const finiteNonNegative = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

/**
 * Match this target's trusted event timestamps to Event Timing, then group by interactionId. Unrelated entries
 * are retained in the raw snapshot but excluded from the measured duration. A censored result is allowed only
 * by a caller that independently verifies the before/after calibration (validateMeasurement below).
 */
export function selectInteraction(snapshot, allowBelowThreshold = false) {
  if (
    !snapshot ||
    !snapshot.supported ||
    snapshot.error !== null ||
    typeof snapshot.documentId !== "string" ||
    !snapshot.documentId ||
    !finiteNonNegative(snapshot.armedAt) ||
    !finiteNonNegative(snapshot.endedAt) ||
    snapshot.endedAt < snapshot.armedAt ||
    !Array.isArray(snapshot.markers) ||
    !Array.isArray(snapshot.entries)
  )
    throw new Error("Invalid or unsupported INP collection window.");
  if (
    snapshot.markers.length !== TARGET_EVENTS.length ||
    TARGET_EVENTS.some((name) => snapshot.markers.filter((marker) => marker?.name === name).length !== 1)
  )
    throw new Error("INP needs one complete trusted pointerdown/pointerup/click sequence.");
  for (const marker of snapshot.markers) {
    if (
      !marker.trusted ||
      !finiteNonNegative(marker.startTime) ||
      marker.startTime < snapshot.armedAt ||
      marker.startTime > snapshot.endedAt
    ) {
      throw new Error("INP target event is untrusted or outside its measurement window.");
    }
  }
  for (const entry of snapshot.entries) {
    if (
      !entry ||
      typeof entry.name !== "string" ||
      !Number.isSafeInteger(entry.interactionId) ||
      entry.interactionId <= 0 ||
      ![entry.startTime, entry.duration, entry.processingStart, entry.processingEnd].every(finiteNonNegative)
    ) {
      throw new Error("Invalid raw Event Timing entry.");
    }
  }
  const inWindow = snapshot.entries.filter(
    (entry) => entry.startTime >= snapshot.armedAt && entry.startTime <= snapshot.endedAt,
  );
  const matched = inWindow.filter((entry) =>
    snapshot.markers.some((marker) => marker.name === entry.name && Math.abs(marker.startTime - entry.startTime) < 2),
  );
  if (!matched.length) {
    if (!allowBelowThreshold) throw new Error("No Event Timing entry; the collection chain must be calibrated.");
    return { duration: INP_FLOOR_MS, status: "below-threshold", interactionId: null };
  }
  if (new Set(matched.map((entry) => entry.interactionId)).size !== 1) {
    throw new Error("The target window contains more than one interactionId.");
  }
  const interactionId = matched[0].interactionId;
  const entries = inWindow.filter((entry) => entry.interactionId === interactionId);
  return { duration: Math.max(...entries.map((entry) => entry.duration)), status: "measured", interactionId };
}

export function validateMeasurement(measurement) {
  if (!measurement?.target || !measurement.calibration?.before || !measurement.calibration.after) {
    throw new Error("INP measurement is missing raw evidence or calibration.");
  }
  const { target, calibration } = measurement;
  for (const window of [calibration.before, calibration.after]) {
    const result = selectInteraction(window);
    if (window.documentId !== target.documentId || result.duration < 32 || result.status !== "measured") {
      throw new Error("INP calibration failed or belongs to a different document.");
    }
  }
  if (calibration.before.endedAt > target.armedAt || target.endedAt > calibration.after.armedAt) {
    throw new Error("INP calibration overlaps the target measurement.");
  }
  const result = selectInteraction(target, true);
  if (measurement.duration !== result.duration || measurement.status !== result.status) {
    throw new Error("INP measurement does not match its raw Event Timing evidence.");
  }
  return measurement;
}

/** A partial diagnostic table is useful, but only a complete report can count as a successful collection. */
export function validateReport(report, expectedRuns = 5) {
  if (!Number.isSafeInteger(expectedRuns) || expectedRuns < 1) {
    throw new Error("Expected INP sample count must be a positive integer.");
  }
  if (
    !report ||
    typeof report !== "object" ||
    report.runs !== expectedRuns ||
    report.cpuSlowdown !== 4 ||
    report.viewport?.width !== 375 ||
    report.viewport?.height !== 812 ||
    report.serverMode !== "e2e-production" ||
    report.method !== "event-timing-interaction"
  ) {
    throw new Error("INP report metadata must match the requested count, CPU 4×, 375×812 and production e2e mode.");
  }
  if (!Array.isArray(report.presses) || report.presses.length !== INP_PRESS_NAMES.length) {
    throw new Error("INP report must contain all five required interactions.");
  }
  const seen = new Set();
  for (const press of report.presses) {
    if (!press || !INP_PRESS_NAMES.includes(press.name) || seen.has(press.name)) {
      throw new Error("INP report contains an unknown or duplicate interaction.");
    }
    seen.add(press.name);
    validateSamples(press.samples);
    if (press.samples.length !== expectedRuns) {
      throw new Error(`INP interaction ${press.name} needs ${expectedRuns} samples; received ${press.samples.length}.`);
    }
    if (!Array.isArray(press.measurements) || press.measurements.length !== expectedRuns) {
      throw new Error(`INP interaction ${press.name} is missing its raw measurements.`);
    }
    press.measurements.forEach((measurement, index) => {
      validateMeasurement(measurement);
      if (measurement.duration !== press.samples[index])
        throw new Error("INP sample disagrees with its raw measurement.");
    });
  }
  return report;
}

/**
 * Smallest supported Event Timing threshold. Only a trusted target with a working before/after calibrated
 * collector may use this censored upper bound; unsupported or broken collection must fail instead.
 */
export const INP_FLOOR_MS = 16;

/** The middle of the samples (the mean of the middle two for an even count). */
export function median(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * One row per press, in the order measured: its median and worst, and whether either is over the budget. A press
 * with no samples (the run broke before it) is `missing`.
 */
export function summarize(presses, budget = INP_BUDGET_MS) {
  return presses.map(({ name, samples }) => {
    validateSamples(samples);
    if (!samples.length) return { name, runs: 0, median: null, worst: null, over: false, missing: true };
    const worst = Math.max(...samples);
    const mid = median(samples);
    return { name, runs: samples.length, median: mid, worst, over: worst > budget, missing: false };
  });
}

/** The table perf-inp.mjs prints (as perf-budget.mjs's), with a closing line. */
export function formatTable(rows, budget = INP_BUDGET_MS) {
  const ms = (n) => (n === null ? "—" : n <= INP_FLOOR_MS ? `≤${INP_FLOOR_MS} ms` : `${Math.round(n)} ms`);
  const lines = ["| 点击 | 次数 | 中位数 | 最差 | 预算 | |", "| --- | --- | --- | --- | --- | --- |"];
  for (const r of rows) {
    const note = r.missing ? "没量到" : r.over ? (r.median > budget ? "超了" : "最差一次超了") : "";
    lines.push(`| ${r.name} | ${r.runs} | ${ms(r.median)} | ${ms(r.worst)} | ${budget} ms | ${note} |`);
  }
  const over = rows.filter((r) => r.over).length;
  const missing = rows.filter((r) => r.missing).length;
  lines.push("");
  if (!rows.length) lines.push("没有可用测量结果，不能判断是否达标。");
  if (missing) lines.push(`${missing} 处没量到，结果不完整，不能判断全部是否达标（看上面的测试输出）。`);
  if (over) lines.push(`${over} 处超过 ${budget} ms（只记数，不挡合并）。`);
  else if (rows.length && !missing) lines.push(`${rows.length} 处都在 ${budget} ms 以内。`);
  return lines.join("\n");
}
