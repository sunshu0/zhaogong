import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { freshEmail, signIn } from "../e2e/helpers";
import { parseRuns, selectInteraction } from "../scripts/perf-inp-rules.mjs";
import { installEventCollector, type TimingWindow } from "./inp-collector";

const RUNS = parseRuns(process.env.INP_RUNS);
const OUT = process.env.INP_OUT || "test-results/inp.json";
const CPU_SLOWDOWN = 4;

type Measurement = {
  duration: number;
  status: string;
  target: TimingWindow;
  calibration: { before: TimingWindow; after: TimingWindow };
};
type Press = { name: string; samples: number[]; measurements: Measurement[] };
const presses: Press[] = [];

async function arm(target: Locator) {
  return target.evaluate((element) => {
    const collector = window.__zgInp;
    if (!collector?.supported || collector.error) throw new Error(collector?.error || "INP collector is unavailable.");
    collector.arm(element);
    return collector.documentId;
  });
}

async function read(page: Page, documentId: string): Promise<TimingWindow> {
  return page.evaluate((expectedId) => {
    const collector = window.__zgInp;
    if (!collector || collector.documentId !== expectedId) {
      throw new Error("The click replaced its document before Event Timing could be read; no fast sample is inferred.");
    }
    return collector.read();
  }, documentId);
}

async function settlePaint(page: Page) {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  // Event Timing callbacks are delivered after paint, in batches. Outside the measured event's duration.
  await page.waitForTimeout(200);
}

/** A trusted, deliberately slow click proves that this document's observer actually delivers entries. */
async function calibrate(page: Page): Promise<TimingWindow> {
  const previousFocus = await page.evaluateHandle(() => document.activeElement);
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.zgInpCalibration = "true";
    button.textContent = "INP calibration";
    // An open native dialog makes the rest of the document inert; calibrate inside its top layer if present.
    const host = document.querySelector("dialog[open]") || document.body;
    const box = host.getBoundingClientRect();
    const left = host === document.body ? 0 : box.left + 8;
    const top = host === document.body ? 0 : box.top + 8;
    button.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:28px;height:24px;z-index:2147483647;font-size:1px`;
    button.addEventListener("click", () => {
      const until = performance.now() + 48;
      while (performance.now() < until) {
        /* Deliberate test-only long handler. */
      }
      button.style.backgroundColor = "red";
    });
    host.append(button);
  });
  const button = page.locator("button[data-zg-inp-calibration]");
  try {
    const documentId = await arm(button);
    await button.tap();
    await settlePaint(page);
    await expect
      .poll(
        async () => {
          const snapshot = await read(page, documentId);
          return snapshot.entries.some((entry) => entry.name === "click" && entry.duration >= 32);
        },
        { timeout: 3_000 },
      )
      .toBe(true);
    const snapshot = await read(page, documentId);
    const result = selectInteraction(snapshot);
    if (result.status !== "measured" || result.duration < 32)
      throw new Error("INP calibration did not deliver its slow click.");
    return snapshot;
  } finally {
    try {
      await button.evaluateAll((buttons) => buttons.forEach((button) => button.remove()));
      await previousFocus.evaluate((element) => {
        if (element instanceof HTMLElement && element.isConnected) element.focus({ preventScroll: true });
      });
    } finally {
      await previousFocus.dispose();
    }
  }
}

async function press(page: Page, target: Locator, shown: () => Promise<void>): Promise<Measurement> {
  await expect(target).toBeVisible();
  await expect(target).toBeEnabled();
  // React's marker is only a readiness check; the expected outcome and unchanged document are checked separately.
  await expect
    .poll(() => target.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactFiber"))))
    .toBe(true);
  const before = await calibrate(page);
  await settlePaint(page);
  await expect(target).toBeEnabled();
  const documentId = await arm(target);
  await target.tap();
  await shown();
  await settlePaint(page);
  const snapshot = await read(page, documentId);
  const after = await calibrate(page);
  if (before.documentId !== documentId || after.documentId !== documentId)
    throw new Error("INP calibration crossed documents.");
  const result = selectInteraction(snapshot, true);
  return { duration: result.duration, status: result.status, target: snapshot, calibration: { before, after } };
}

async function measure(name: string, once: () => Promise<Measurement>) {
  const entry: Press = { name, samples: [], measurements: [] };
  presses.push(entry);
  for (let run = 0; run < RUNS; run++) {
    const result = await once();
    entry.samples.push(result.duration);
    entry.measurements.push(result);
  }
  console.log(`INP ${name}: ${entry.samples.join(", ")} ms`);
}

test.use({ reducedMotion: "reduce" });
test.afterAll(() => {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        method: "event-timing-interaction",
        serverMode: "e2e-production",
        viewport: { width: 375, height: 812 },
        runs: RUNS,
        cpuSlowdown: CPU_SLOWDOWN,
        presses,
      },
      null,
      2,
    ),
  );
});

test("five main presses on a phone, CPU 4× slower", async ({ page }) => {
  test.setTimeout(10 * 60_000);
  expect(page.viewportSize()).toEqual({ width: 375, height: 812 });
  await page.addInitScript(installEventCollector);
  await signIn(page, "/jobs", freshEmail("perf.inp"));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
  try {
    await measure("职位列表点卡片", async () => {
      await page.goto("/jobs");
      const card = page.getByRole("main").locator('a[href="/jobs/j1"]').first();
      return press(page, card, () => expect(page).toHaveURL("/jobs/j1"));
    });
    await measure("详情页「立即沟通」", async () => {
      await page.goto("/jobs/j1");
      const chat = page.getByRole("main").getByRole("button", { name: "立即沟通", exact: true });
      return press(page, chat, () => expect(page).toHaveURL(/\/messages\?conversation=employer%3A/));
    });
    const conversation = page.url();
    await measure("聊天里发一条消息", async () => {
      await page.goto(conversation);
      const text = `量一下发消息有多快 ${Date.now()}-${Math.random()}`;
      await page.getByLabel("输入消息").fill(text);
      const send = page.getByRole("button", { name: "发送", exact: true });
      return press(page, send, () => expect(page.getByRole("log", { name: "消息记录" })).toContainText(text));
    });
    await measure("底部「更多」打开", async () => {
      await page.goto(conversation);
      const more = page.getByRole("button", { name: /^更多：/ }).filter({ visible: true });
      const sheet = page.getByRole("dialog", { name: /^更多：/ });
      return press(page, more, () => expect(sheet).toBeVisible());
    });
    await measure("筛选弹层打开", async () => {
      await page.goto("/jobs");
      const filters = page.getByRole("button", { name: /^筛选/ });
      return press(page, filters, () => expect(page.getByRole("button", { name: "查看职位" })).toBeVisible());
    });
  } finally {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  }
});
