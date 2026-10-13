import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("workspace navigation stays visible across its pages", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem("zhaogong:session", JSON.stringify({
      email: "workspace@example.com", signedInAt: "2026-10-13T00:00:00.000Z", activeRole: "seeker",
    }));
  });
  await page.goto("/workspace");
  await expect(page.getByRole("banner").getByRole("link", { name: "聊天", exact: true })).toBeVisible();
  if (testInfo.project.name === "desktop") await expect(page.getByRole("banner").getByRole("link", { name: "工作台", exact: true })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "工作台导航" }).filter({ visible: true });
  for (const [label, route] of [["聊天", "/messages"], ["通知", "/notifications"], [testInfo.project.name === "mobile" ? "主页" : "我的主页", "/profile"]]) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(nav.getByRole("link", { name: label, exact: true })).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "求职者工作台", level: 1 })).toBeVisible();
  await page.screenshot({ path: `D:/dev/zhaogong-shots/workspace-${testInfo.project.name}.png`, fullPage: true });
});

test("signed-out workspace sign-in returns to the selected page", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("main").getByRole("link", { name: "登录 / 注册" })).toHaveAttribute("href", "/login?next=%2Fprofile");
});
