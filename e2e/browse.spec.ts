import { expect, test } from "@playwright/test";
import { siteNav } from "./helpers";

test("list → filter → detail → back to the filtered list", async ({ page }, testInfo) => {
  // From 1024 px the filters are a column where each change applies at once; below, a panel behind 筛选.
  const desktop = testInfo.project.name === "desktop";
  await page.goto("/jobs");
  await expect(page.getByRole("heading", { name: "奥克兰中文工作" })).toBeVisible();
  await expect(page.getByText(/共 \d+ 个职位，最新发布在前/).filter({ visible: true })).toBeVisible();

  // Newest first (other specs may publish newer jobs, so compare demo jobs with each other).
  const titles = await page.getByRole("main").getByRole("heading", { level: 2 }).allTextContents();
  expect(titles).toEqual(expect.arrayContaining(["超市理货员", "前厅服务员", "店长"]));
  expect(titles.indexOf("超市理货员")).toBeLessThan(titles.indexOf("前厅服务员"));
  expect(titles.indexOf("前厅服务员")).toBeLessThan(titles.indexOf("店长"));

  if (!desktop) await page.getByRole("button", { name: /^筛选/ }).click();
  // Each group opens with a click (#63).
  await page.getByRole("button", { name: "行业" }).click();
  await page.getByRole("group", { name: "行业" }).getByText("餐饮", { exact: true }).click();
  if (desktop) await expect(page).toHaveURL("/jobs?industry=hospitality");
  await page.getByRole("button", { name: "食宿" }).click();
  await page.getByRole("group", { name: "食宿" }).getByText("包餐", { exact: true }).click();
  if (!desktop) await page.getByRole("button", { name: "查看职位" }).click();

  await expect(page).toHaveURL("/jobs?industry=hospitality&meals=1");
  await expect(page.getByText(/找到 \d+ 个职位/).filter({ visible: true })).toBeVisible();
  if (desktop) {
    await expect(page.getByRole("group", { name: "食宿" }).getByLabel("包餐")).toBeChecked();
  } else {
    await expect(page.locator("#job-filters")).toBeHidden(); // 查看职位 closes the panel
    await expect(page.getByRole("button", { name: "筛选 · 2" })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "去掉条件：餐饮" })).toBeVisible();
  await expect(page.getByRole("link", { name: /超市理货员/ })).toHaveCount(0); // retail, no meals

  await page.getByRole("link", { name: /点心师傅/ }).click();
  await expect(page).toHaveURL("/jobs/j3");
  await expect(page.getByRole("heading", { level: 1, name: "点心师傅" })).toBeVisible();
  await expect(page.getByText("Dim sum chef").filter({ visible: true })).toBeVisible();
  // A29: one description at a time, Chinese first.
  await expect(page.getByRole("heading", { name: "职位描述" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "中文" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "English" }).click();
  await expect(page.getByRole("tabpanel")).toHaveAttribute("lang", "en");
  await expect(page.getByText("认证雇主", { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page).toHaveTitle("点心师傅 · $30–35/小时 · Northcote · 找工");

  await page.getByRole("link", { name: "职位列表" }).click();
  await expect(page).toHaveURL("/jobs?industry=hospitality&meals=1");
  await expect(page.getByText(/找到 \d+ 个职位/).filter({ visible: true })).toBeVisible();
});

test("a keyword with no match shows the empty state, which clears the filters", async ({ page }) => {
  await page.goto("/jobs?region=akl-northcote");
  const search = page.getByRole("searchbox", { name: "搜索职位" });
  await search.fill("叉车");
  await search.press("Enter");

  await expect(page).toHaveURL(/q=%E5%8F%89%E8%BD%A6/);
  await expect(page.getByText("暂时没有符合条件的职位").filter({ visible: true })).toBeVisible();
  // A tap during hydration can be lost on a slow server (mobile flake); tap again until the list changes.
  const clear = page.getByRole("link", { name: "清除筛选，看全部职位" });
  await expect(async () => {
    // Tap only while the link is still there: a slow navigation from the last tap may still be on its way.
    if (await clear.isVisible()) await clear.click({ timeout: 2000 });
    await expect(page).toHaveURL("/jobs", { timeout: 3000 });
  }).toPass();
  await expect(page.getByText(/共 \d+ 个职位，最新发布在前/).filter({ visible: true })).toBeVisible();
});

test("a job near the minimum wage says so, and an unknown job is not found", async ({ page }) => {
  await page.goto("/jobs/j13");
  await expect(page.getByText("接近新西兰最低时薪 $23.95（2026-04-01 起）。").filter({ visible: true })).toBeVisible();
  await expect(
    page.getByText(/签证一项是雇主提供的信息，不构成签证或移民建议。/).filter({ visible: true }),
  ).toBeVisible();

  await page.goto("/jobs/nope");
  await expect(page.getByRole("heading", { name: "这个职位不存在或已下架" })).toBeVisible();
});

test("links shared before the move to /jobs still open the same filtered list", async ({ page }) => {
  await page.goto("/?industry=retail&meals=1&q=%E6%94%B6%E9%93%B6");
  await expect(page).toHaveURL("/jobs?industry=retail&meals=1&q=%E6%94%B6%E9%93%B6");
  // .first(): right after the redirect the stylesheet may not have hidden the other navigation yet; both link here.
  await expect(
    siteNav(page)
      .getByRole("link", { name: /^(找工作|职位)$/ })
      .first(),
  ).toHaveAttribute("href", "/jobs");
});
