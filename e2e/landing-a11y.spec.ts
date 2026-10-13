import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("/ has no axe violations (WCAG 2.1 A and AA)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "精选工作" }).getByRole("listitem").first()).toBeVisible();
  await expect(page.getByRole("region", { name: "平台数据" })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const found = violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(found).toEqual([]);
});

test("/ never scrolls sideways at 375, 1280, 1440 or 1920 px", async ({ page }) => {
  for (const [width, height] of [
    [375, 812],
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.getByRole("region", { name: "精选工作" }).getByRole("listitem").first()).toBeVisible();
    const scrollX = await page.evaluate(() => {
      window.scrollTo(10_000, window.scrollY);
      return window.scrollX;
    });
    expect(scrollX, `${width}px`).toBe(0);
  }
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the landing page still exposes stats and jobs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "登录 / 注册" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "平台数据" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "精选工作" })).toBeVisible();
    await expect(page.getByRole("link", { name: "浏览全部职位 →" })).toBeVisible();
  });
});
