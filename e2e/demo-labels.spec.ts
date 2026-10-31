import { expect, test } from "@playwright/test";

// User feedback 10-30 #2: the demo site's made-up businesses never read as checked. The tests' server runs with
// DEMO_DATA=true, so every job here is demo data.
test("demo jobs say 演示企业 on the cards and the job page, and 【演示】 in the share card; no level is claimed", async ({
  page,
}) => {
  await page.goto("/jobs");
  const cards = page.getByRole("main").getByRole("article");
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  await expect(page.getByRole("main").locator("article [data-demo-badge]").filter({ visible: true })).toHaveCount(
    count,
  );
  await expect(page.getByRole("main").getByText(/^(已验证企业|认证雇主)$/)).toHaveCount(0);

  const response = await page.goto("/jobs/j3");
  // The employer card is on the page twice (the sheet's below lg, the side column's from lg): the shown one says it.
  await expect(
    page.getByText("演示数据：这家店和它的职位是演示用的，不是真的在招人。").filter({ visible: true }).first(),
  ).toBeVisible();
  const html = await response!.text();
  expect(html).toMatch(/<meta property="og:title" content="【演示】/);
  expect(html).toMatch(/<meta property="og:description" content="【演示】/);

  await page.goto("/employers/e1");
  await expect(page.getByRole("main").getByText("演示企业", { exact: true }).first()).toBeVisible();
  // 认证雇主 stays as the label of its row in 公司资质, whose answer is 未提供认证信息 for a demo business.
  const claims = page.getByRole("main").getByText(/^(已验证企业|认证雇主)$/);
  await expect(claims.and(page.locator(":not(dt)"))).toHaveCount(0);
  await expect(page.getByRole("region", { name: "公司资质", exact: true })).toContainText("未提供认证信息");
});

test("the home page says it the same way: 演示企业 on the window notices, and the count claims none verified", async ({
  page,
}) => {
  await page.goto("/");
  const notices = page.getByRole("list", { name: "正在招聘" }).getByRole("listitem");
  await expect(notices).toHaveCount(3);
  await expect(notices.locator("[data-demo-badge]")).toHaveCount(3);
  await expect(notices.first().getByText("演示企业", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText(/^(已验证企业|认证雇主)$/)).toHaveCount(0);
  await expect(page.locator("[data-hero-counts]")).toContainText("家演示企业");
  await expect(page.locator("[data-hero-counts]")).not.toContainText("已验证");
});
