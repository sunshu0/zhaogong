import { expect, test } from "@playwright/test";
import { chatEntry, siteNav } from "./helpers";
import AxeBuilder from "@axe-core/playwright";

test("workspace navigation stays visible across its pages", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "zhaogong:session",
      JSON.stringify({
        email: "workspace@example.com",
        signedInAt: "2026-10-13T00:00:00.000Z",
        activeRole: "seeker",
      }),
    );
  });
  await page.goto("/workspace");
  await expect(chatEntry(page)).toBeVisible();
  const mobile = testInfo.project.name === "mobile";
  if (!mobile) await expect(siteNav(page).getByRole("link", { name: "工作台", exact: true })).toBeVisible();
  // Phones reach the workspace pages from 我的 in the bottom bar; desktop has the sidebar.
  const nav = mobile
    ? page.getByRole("main")
    : page.getByRole("navigation", { name: "工作台导航" }).filter({ visible: true });
  for (const [label, route] of [
    ["通知", "/notifications"],
    ["我的主页", "/profile"],
    ["浏览与举报", "/me"],
  ]) {
    if (mobile) {
      await siteNav(page).getByRole("link", { name: "我的", exact: true }).click();
      await expect(page).toHaveURL("/account");
    }
    await nav.getByRole("link", { name: new RegExp(`^${label}`) }).click();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    const current = mobile
      ? siteNav(page).getByRole("link", { name: "我的", exact: true })
      : nav.getByRole("link", { name: label, exact: true });
    await expect(current).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "求职者工作台", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: `D:/dev/zhaogong-shots/workspace-${testInfo.project.name}.png`, fullPage: true });
});

test("signed-out workspace sign-in returns to the selected page", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("main").getByRole("link", { name: "登录 / 注册" })).toHaveAttribute(
    "href",
    "/login?next=%2Fprofile",
  );
});
