// #323: /privacy and /terms in both languages: the title, the table of contents leading to each section, the official
// links, axe; in English no Chinese of the page's own.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { chineseLeft, useEnglish } from "./helpers/english";
import { waitForTitle } from "./helpers/title";

test.use({ reducedMotion: "reduce" });

async function expectNoViolations(page: Page) {
  await waitForTitle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
}

for (const [path, title, first, link] of [
  ["/privacy", "隐私说明", "1. 谁在收集你的信息", "向隐私专员投诉（privacy.org.nz）"],
  ["/terms", "使用条款", "1. 关于这些条款", "现行最低工资（employment.govt.nz）"],
] as const) {
  test(`${path} in Chinese: contents, sections and the official links (#323)`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    const toc = page.getByRole("navigation", { name: "目录" });
    await toc.getByRole("link", { name: first }).click();
    await expect(page.getByRole("heading", { name: first, level: 2 })).toBeInViewport();
    await expect(page.getByRole("link", { name: link })).toHaveAttribute("href", /^https:\/\//);
    await expectNoViolations(page);
  });
}

for (const [path, title] of [
  ["/privacy", "Privacy"],
  ["/terms", "Terms of use"],
] as const) {
  test(`${path} in English (#323)`, async ({ page, baseURL }) => {
    await useEnglish(page, baseURL);
    await page.goto(path);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Contents" })).toBeVisible();
    expect(await chineseLeft(page)).toEqual([]);
    await expectNoViolations(page);
  });
}
