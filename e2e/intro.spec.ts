import { expect, test } from "@playwright/test";
import { DEMO_DATA, visibleStats } from "../src/config/landing";

test("landing: the first screen has the logo, positioning, both buttons and real stats", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("找工 · 奥克兰的中文工作平台");
  const hero = page.getByRole("region", { name: "奥克兰的中文工作平台" });
  await expect(hero.locator('img[src*="icon-192"]')).toBeVisible();
  await expect(hero.getByText("找工", { exact: true })).toBeVisible();
  await expect(hero.getByRole("heading", { level: 1, name: "奥克兰的中文工作平台" })).toBeVisible();
  await expect(hero.getByRole("link", { name: "注册", exact: true })).toBeInViewport();
  await expect(hero.getByRole("link", { name: "直接浏览工作" })).toBeInViewport();

  // Fills the screen below the header, and nothing below it shows yet.
  const viewport = page.viewportSize()!;
  const box = (await hero.boundingBox())!;
  expect(box.y + box.height).toBeGreaterThanOrEqual(viewport.height - 2);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2);
  await expect(page.getByRole("heading", { name: "精选工作" })).not.toBeInViewport();

  const stats = hero.getByRole("region", { name: "平台数据" });
  await expect(stats).toBeInViewport();
  const shown = visibleStats({ employersPosting: 0, jobsPosted: 0, hiresConfirmed: 0, contactViews: 0 });
  for (const { label } of DEMO_DATA ? shown : []) {
    const value = stats.getByRole("term").filter({ hasText: label }).locator("xpath=following-sibling::dd | preceding-sibling::dd");
    await expect(value).toHaveText(/^\d{1,3}(,\d{3})*$/);
  }
  if (DEMO_DATA) await expect(stats.getByText("演示数据", { exact: true })).toBeVisible();
});

test("landing: featured jobs from verified employers, our positioning, and the employer part", async ({ page }) => {
  await page.goto("/");
  const featured = page.getByRole("region", { name: "精选工作" });
  const cards = featured.getByRole("listitem").getByRole("link");
  await expect(cards).toHaveCount(6);
  for (const href of await cards.evaluateAll((links) => links.map((a) => a.getAttribute("href")))) {
    expect(href).toMatch(/^\/jobs\/j\d+$/);
  }
  await expect(featured.getByText("未验证")).toHaveCount(0);

  const positioning = page.getByRole("region", { name: "我们的定位" });
  for (const title of ["中文为主", "发布前查合规", "雇主可信", "对求职者免费"]) {
    await expect(positioning.getByText(title, { exact: true })).toBeVisible();
  }
  const employer = page.getByRole("region", { name: "招人？一分钟发布招聘" });
  await expect(employer.getByRole("link", { name: "雇主发布招聘 →" })).toHaveAttribute("href", "/employer");
  expect((await employer.boundingBox())!.y).toBeGreaterThan((await positioning.boundingBox())!.y);

  await cards.first().click();
  await expect(page).toHaveURL(/\/jobs\/j\d+$/);
  await page.goBack();
  await featured.getByRole("link", { name: "查看全部职位 →" }).click();
  await expect(page).toHaveURL("/jobs");
});

test("注册 goes through 注册或登录 and lands on the job list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "注册", exact: true }).click();
  await expect(page).toHaveURL("/login?next=%2Fjobs");
  await expect(page.getByRole("heading", { level: 1, name: "注册或登录" })).toBeVisible();

  await page.getByLabel("邮箱", { exact: true }).fill("new.seeker@example.com");
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByText("输入任意 6 位数字即可注册或登录").filter({ visible: true })).toBeVisible();
  await page.getByLabel("验证码").fill("135790");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs");
  await expect(page.getByRole("banner").getByRole("link", { name: "我的" })).toBeVisible();
});

test("直接浏览工作 opens the job list; the logo leads back to the intro", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "直接浏览工作" }).click();
  await expect(page).toHaveURL("/jobs");
  await expect(page.getByRole("heading", { level: 1, name: "奥克兰中文工作" })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: "奥克兰的中文工作平台" })).toBeVisible();
});
