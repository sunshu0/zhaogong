import { describe, expect, it } from "vitest";
import {
  INP_BUDGET_MS,
  INP_PRESS_NAMES,
  formatTable,
  median,
  parseRuns,
  selectInteraction,
  summarize,
  validateMeasurement,
  validateReport,
} from "./perf-inp-rules.mjs";

describe("median", () => {
  it("is the middle sample, or the mean of the middle two, whatever the order", () => {
    expect(median([40, 16, 120, 24, 32])).toBe(32);
    expect(median([40, 16, 24, 32])).toBe(28);
    expect(median([56])).toBe(56);
  });
});

describe("summarize", () => {
  it("gives each press its median and worst; over when the worst passes the budget", () => {
    expect(
      summarize([
        { name: "点卡片", samples: [48, 56, 40, 64, 48] },
        { name: "发消息", samples: [120, 104, 232, 112, 96] },
        { name: "筛选", samples: [200, 200, 200, 200, 200] },
      ]),
    ).toEqual([
      { name: "点卡片", runs: 5, median: 48, worst: 64, over: false, missing: false },
      { name: "发消息", runs: 5, median: 112, worst: 232, over: true, missing: false },
      { name: "筛选", runs: 5, median: 200, worst: 200, over: false, missing: false },
    ]);
  });

  it("marks a press with no samples as missing, not over", () => {
    expect(summarize([{ name: "更多", samples: [] }])).toEqual([
      { name: "更多", runs: 0, median: null, worst: null, over: false, missing: true },
    ]);
  });
});

describe("formatTable", () => {
  it("lists every press against the budget and says how many are over, without failing", () => {
    const table = formatTable(
      summarize([
        { name: "点卡片", samples: [16, 16, 24] },
        { name: "发消息", samples: [104, 232, 112] },
        { name: "打开筛选", samples: [240, 260, 250] },
      ]),
    );
    expect(table).toContain("| 点卡片 | 3 | ≤16 ms | 24 ms | 200 ms |  |");
    expect(table).toContain("| 发消息 | 3 | 112 ms | 232 ms | 200 ms | 最差一次超了 |");
    expect(table).toContain("| 打开筛选 | 3 | 250 ms | 260 ms | 200 ms | 超了 |");
    expect(table.endsWith(`2 处超过 ${INP_BUDGET_MS} ms（只记数，不挡合并）。`)).toBe(true);
  });

  it("says when all are within the budget, and names presses it could not measure", () => {
    expect(formatTable(summarize([{ name: "点卡片", samples: [40] }]))).toMatch(/1 处都在 200 ms 以内。$/);
    const table = formatTable(summarize([{ name: "更多", samples: [] }]));
    expect(table).toContain("| 更多 | 0 | — | — | 200 ms | 没量到 |");
    expect(table).toContain("1 处没量到");
    expect(table).not.toContain("都在 200 ms 以内");
    expect(formatTable(summarize([]))).not.toContain("都在 200 ms 以内");
  });
});

function timingWindow(offset, duration = 48) {
  return {
    documentId: "test-document",
    supported: true,
    error: null,
    armedAt: offset,
    endedAt: offset + 90,
    markers: [
      { name: "pointerdown", startTime: offset + 10, trusted: true },
      { name: "pointerup", startTime: offset + 20, trusted: true },
      { name: "click", startTime: offset + 21, trusted: true },
    ],
    entries: [
      {
        name: "click",
        interactionId: 7,
        startTime: offset + 21,
        duration,
        processingStart: offset + 22,
        processingEnd: offset + 25,
      },
    ],
  };
}

function measurement(duration = 24) {
  const target = timingWindow(100, duration);
  target.endedAt = 500;
  return {
    duration,
    status: "measured",
    target,
    calibration: { before: timingWindow(0), after: timingWindow(600) },
  };
}

function report(runs = 5) {
  return {
    method: "event-timing-interaction",
    serverMode: "e2e-production",
    viewport: { width: 375, height: 812 },
    runs,
    cpuSlowdown: 4,
    presses: INP_PRESS_NAMES.map((name) => ({
      name,
      samples: Array(runs).fill(24),
      measurements: Array.from({ length: runs }, () => measurement()),
    })),
  };
}

describe("INP run count", () => {
  it("defaults to five and accepts a positive decimal override", () => {
    expect(parseRuns(undefined)).toBe(5);
    expect(parseRuns("3")).toBe(3);
  });
  it.each(["-1", "0", "1.5", "NaN", "Infinity", "", " ", "5x", "0x5", "9007199254740992", 5, null])(
    "rejects invalid count %s before any browser work",
    (value) => expect(() => parseRuns(value)).toThrow(),
  );
});

describe("raw interaction selection", () => {
  it("matches trusted target timestamps and takes the longest event of one interactionId", () => {
    const window = timingWindow(100);
    window.entries.push({
      name: "pointerup",
      interactionId: 7,
      startTime: 120,
      duration: 56,
      processingStart: 121,
      processingEnd: 122,
    });
    window.entries.push({
      name: "mouseup",
      interactionId: 7,
      startTime: 120,
      duration: 64,
      processingStart: 121,
      processingEnd: 122,
    });
    window.entries.push({
      name: "click",
      interactionId: 99,
      startTime: 160,
      duration: 1000,
      processingStart: 161,
      processingEnd: 162,
    });
    expect(selectInteraction(window)).toEqual({ duration: 64, status: "measured", interactionId: 7 });
  });
  it("rejects unsupported collection, errors, untrusted/incomplete events and multiple ids", () => {
    const invalid = [
      { ...timingWindow(100), supported: false },
      { ...timingWindow(100), error: "observer failed" },
      { ...timingWindow(100), markers: [] },
      { ...timingWindow(100), markers: timingWindow(100).markers.map((marker) => ({ ...marker, trusted: false })) },
    ];
    for (const window of invalid) expect(() => selectInteraction(window, true)).toThrow();
    const mixed = timingWindow(100);
    mixed.entries.push({
      name: "pointerup",
      interactionId: 8,
      startTime: 120,
      duration: 24,
      processingStart: 121,
      processingEnd: 122,
    });
    expect(() => selectInteraction(mixed)).toThrow(/more than one interactionId/);
  });
  it("does not infer a fast value from absent entries without complete calibration evidence", () => {
    const fast = measurement();
    fast.target.entries = [];
    fast.duration = 16;
    fast.status = "below-threshold";
    expect(() => selectInteraction(fast.target)).toThrow(/calibrated/);
    expect(validateMeasurement(fast)).toBe(fast);
    fast.calibration.before.entries = [];
    expect(() => validateMeasurement(fast)).toThrow();
  });
  it("rejects document changes, overlapping calibration, and a duration that disagrees with raw evidence", () => {
    const changed = measurement();
    changed.calibration.after.documentId = "new-document";
    expect(() => validateMeasurement(changed)).toThrow(/different document/);
    const overlap = measurement();
    overlap.calibration.before.endedAt = 101;
    expect(() => validateMeasurement(overlap)).toThrow(/overlaps/);
    const fabricated = measurement();
    fabricated.duration = 16;
    expect(() => validateMeasurement(fabricated)).toThrow(/raw Event Timing/);
  });
});

describe("complete INP report", () => {
  it("accepts all five interactions with their exact requested count and raw evidence", () => {
    const good = report();
    expect(validateReport(good)).toBe(good);
    expect(validateReport(report(3), 3).runs).toBe(3);
  });
  it("rejects missing, duplicate and unexpected interactions", () => {
    const missing = report();
    missing.presses.pop();
    expect(() => validateReport(missing)).toThrow();
    for (const name of [INP_PRESS_NAMES[1], "unexpected"]) {
      const bad = report();
      bad.presses[0].name = name;
      expect(() => validateReport(bad)).toThrow();
    }
  });
  it("rejects empty, short or extra samples, and missing raw evidence", () => {
    for (const samples of [[], [24], Array(6).fill(24)]) {
      const bad = report();
      bad.presses[0].samples = samples;
      expect(() => validateReport(bad)).toThrow();
    }
    const noEvidence = report();
    noEvidence.presses[0].measurements = [];
    expect(() => validateReport(noEvidence)).toThrow(/raw measurements/);
  });
  it.each([NaN, Infinity, -Infinity, -1, null, "24"])("rejects invalid sample %s", (sample) => {
    const bad = report();
    bad.presses[0].samples[0] = sample;
    expect(() => validateReport(bad)).toThrow();
    expect(() => summarize([{ name: "invalid", samples: [sample] }])).toThrow();
  });
  it("rejects missing or wrong run, CPU, viewport, method, and server metadata", () => {
    for (const bad of [
      null,
      {},
      { ...report(), runs: -1 },
      { ...report(), runs: 3 },
      { ...report(), cpuSlowdown: 1 },
      { ...report(), viewport: { width: 1280, height: 812 } },
      { ...report(), serverMode: "dev" },
      { ...report(), method: "unknown" },
    ]) {
      expect(() => validateReport(bad)).toThrow();
    }
    expect(() => validateReport(report(), -1)).toThrow();
  });
  it("keeps valid slow samples advisory", () => {
    const slow = report();
    slow.presses[0].samples[2] = 232;
    slow.presses[0].measurements[2] = measurement(232);
    expect(formatTable(summarize(validateReport(slow).presses))).toContain("1 处超过 200 ms（只记数，不挡合并）");
  });
});
