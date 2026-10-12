import { expect, test, type Page } from "@playwright/test";

// The stats band's numbers count up from 0 to the real value the first time the band is in view.

const counters = (page: Page) => page.getByRole("region", { name: "平台数据" }).locator("[data-count-up]");
const finals = (page: Page) =>
  page.getByRole("region", { name: "平台数据" }).locator("dd .sr-only").allTextContents();

test.describe("at 1280 × 800", () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test("the numbers start below their final values and stop on them", async ({ page }) => {
    await page.goto("/");
    const spans = counters(page);
    await expect(spans.first()).toBeVisible(); // hidden (keeping its size) until the count-up takes over
    const target = await finals(page);
    const largest = target.map((t) => Number(t.replace(/,/g, ""))).indexOf(Math.max(...target.map((t) => Number(t.replace(/,/g, "")))));
    const first = Number((await spans.nth(largest).textContent())!.replace(/,/g, ""));
    expect(first).toBeLessThan(Number(target[largest].replace(/,/g, "")));
    for (const [i, value] of target.entries()) await expect(spans.nth(i)).toHaveText(value, { timeout: 5_000 });
  });

  test("no layout shift: the band keeps its size while counting", async ({ page }) => {
    await page.goto("/");
    const dl = page.getByRole("region", { name: "平台数据" }).locator("dl");
    await expect(counters(page).first()).toBeVisible();
    const before = (await dl.boundingBox())!;
    const target = await finals(page);
    for (const [i, value] of target.entries()) await expect(counters(page).nth(i)).toHaveText(value, { timeout: 5_000 });
    const after = (await dl.boundingBox())!;
    expect(after.height).toBe(before.height);
    expect(after.width).toBe(before.width);
  });
});

test("after scrolling to the band, the final values are shown", async ({ page }) => {
  await page.goto("/");
  const band = page.getByRole("region", { name: "平台数据" });
  await band.scrollIntoViewIfNeeded();
  const target = await finals(page);
  for (const [i, value] of target.entries()) await expect(counters(page).nth(i)).toHaveText(value, { timeout: 5_000 });
});

test("with reduced motion the final values show at once and do not move", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const spans = counters(page);
  await expect(spans.first()).toBeVisible();
  const target = await finals(page);
  for (let sample = 0; sample < 5; sample++) {
    expect(await spans.allTextContents()).toEqual(target);
    await page.waitForTimeout(100);
  }
});

test("the page's HTML carries the real numbers for crawlers and share previews", async ({ request }) => {
  const html = await (await request.get("/")).text();
  const real = [...html.matchAll(/<span class="sr-only">([0-9,]+)<\/span>/g)].map((m) => m[1]);
  const drawn = [...html.matchAll(/data-count-up=""[^>]*>([0-9,]+)</g)].map((m) => m[1]);
  expect(real.length).toBeGreaterThan(0);
  expect(drawn).toEqual(real); // the digits start as the real numbers, not 0
});
