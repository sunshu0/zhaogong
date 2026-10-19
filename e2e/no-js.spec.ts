import { expect, test } from "@playwright/test";

// #13: with JavaScript off, the streamed parts of a page show (after its fixed content) instead of endless
// loading placeholders. See docs/no-javascript.md for what still needs scripts.
test.use({ javaScriptEnabled: false });

test("the job list shows its jobs, not placeholders", async ({ page }) => {
  await page.goto("/jobs");
  const list = page.getByRole("region", { name: "职位列表" });
  await expect(list).toBeVisible();
  await expect(list.locator("article").nth(2)).toBeVisible();
  await expect(page.locator("[data-nojs-hide]:visible")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
});

test("a job page shows the job and its facts", async ({ page }) => {
  await page.goto("/jobs/j1");
  await expect(page.getByRole("heading", { level: 1, name: "前厅服务员" })).toBeVisible();
  await expect(page.getByRole("region", { name: "职位信息" }).locator("dt").first()).toHaveText("地区");
  await expect(page.getByRole("heading", { name: "职位描述" })).toBeVisible();
  await expect(page.locator("[data-nojs-hide]:visible")).toHaveCount(0);
});

test("an employer page shows the employer", async ({ page }) => {
  await page.goto("/employers/e1");
  await expect(page.getByRole("heading", { level: 1, name: "川味小馆" })).toBeVisible();
  await expect(page.getByText("加载企业主页…")).toBeHidden();
});

test("实习 lists its external jobs, not placeholders (#292)", async ({ page }) => {
  await page.goto("/internships");
  await expect(page.getByRole("heading", { level: 1, name: "实习" })).toBeVisible();
  const list = page.getByRole("region", { name: /列表$/ });
  await expect(list.getByRole("link", { name: "Firmware Intern (Summer 2026/27)" })).toBeVisible();
  await expect(page.locator("[data-nojs-hide]:visible")).toHaveCount(0);
});

test("an external job page shows its facts and 去官网申请 (#292)", async ({ page }) => {
  await page.goto(`/external/${encodeURIComponent("demo-kowhai:4005")}`);
  const job = page.getByRole("article", { name: "Firmware Intern (Summer 2026/27)" });
  await expect(job.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(job.getByRole("region", { name: "职位信息（按官网原文整理）" }).locator("dt").first()).toBeVisible();
  // A demo job's 去官网申请 explains itself with a script; without one the button is there, and nothing breaks.
  await expect(job.getByRole("button", { name: "去官网申请", exact: true })).toBeVisible();
  await expect(page.locator("[data-nojs-hide]:visible")).toHaveCount(0);
});

test("sign-in says it needs JavaScript instead of loading forever", async ({ page }) => {
  await page.goto("/login");
  // Playwright's text locators skip <noscript>; read what the page shows instead.
  await expect.poll(() => page.evaluate(() => document.body.innerText)).toContain("登录需要浏览器开启 JavaScript。");
  await expect(page.locator("[data-nojs-hide]:visible")).toHaveCount(0);
});
