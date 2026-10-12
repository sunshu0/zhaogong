import { expect, test } from "@playwright/test";

test("list → filter → detail → back to the filtered list", async ({ page }, testInfo) => {
  await page.goto("/jobs");
  await expect(page.getByRole("heading", { name: "奥克兰中文工作" })).toBeVisible();
  await expect(page.getByText(/共 \d+ 个职位，最新发布在前/).filter({ visible: true })).toBeVisible();

  // Newest first (other specs may publish newer jobs, so compare demo jobs with each other).
  const titles = await page.getByRole("main").getByRole("heading", { level: 2 }).allTextContents();
  expect(titles).toEqual(expect.arrayContaining(["超市理货员", "前厅服务员", "店长"]));
  expect(titles.indexOf("超市理货员")).toBeLessThan(titles.indexOf("前厅服务员"));
  expect(titles.indexOf("前厅服务员")).toBeLessThan(titles.indexOf("店长"));

  // Phones open the filter panel; from 1024 px it is always shown in the left column.
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: /^筛选/ }).click();
  await page.getByRole("group", { name: "行业" }).getByText("餐饮", { exact: true }).click();
  await page.getByRole("group", { name: "食宿" }).getByText("包餐", { exact: true }).click();
  await page.getByRole("button", { name: "查看职位" }).click();

  await expect(page).toHaveURL("/jobs?industry=hospitality&meals=1");
  await expect(page.getByText(/找到 \d+ 个职位/).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "去掉条件：餐饮" })).toBeVisible();
  await expect(page.getByRole("link", { name: /超市理货员/ })).toHaveCount(0); // retail, no meals

  await page.getByRole("link", { name: /点心师傅/ }).click();
  await expect(page).toHaveURL("/jobs/j3");
  await expect(page.getByRole("heading", { level: 1, name: "点心师傅" })).toBeVisible();
  await expect(page.getByText("Dim sum chef").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "职位描述" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Job description" })).toBeVisible();
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
  await page.getByRole("link", { name: "清除筛选，看全部职位" }).click();
  await expect(page).toHaveURL("/jobs");
  await expect(page.getByText(/共 \d+ 个职位，最新发布在前/).filter({ visible: true })).toBeVisible();
});

test("a job near the minimum wage says so, and an unknown job is not found", async ({ page }) => {
  await page.goto("/jobs/j13");
  await expect(page.getByText("接近新西兰最低时薪 $23.95（2026-04-01 起）。").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("以上为雇主提供的信息，不构成签证或移民建议。").filter({ visible: true })).toBeVisible();

  await page.goto("/jobs/nope");
  await expect(page.getByRole("heading", { name: "这个职位不存在或已下架" })).toBeVisible();
});

test("links shared before the move to /jobs still open the same filtered list", async ({ page }) => {
  await page.goto("/?industry=retail&meals=1&q=%E6%94%B6%E9%93%B6");
  await expect(page).toHaveURL("/jobs?industry=retail&meals=1&q=%E6%94%B6%E9%93%B6");
  await expect(page.getByRole("banner").getByRole("link", { name: "找工作" })).toHaveAttribute("href", "/jobs");
});
