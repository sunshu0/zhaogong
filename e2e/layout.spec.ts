import { expect, test, type Locator, type Page } from "@playwright/test";

const box = async (locator: Locator) => (await locator.boundingBox())!;
const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("home: filters in a left column that stays in view on desktop, behind 筛选 on phones", async ({ page }, testInfo) => {
  await page.goto("/");
  const panel = page.locator("#job-filters");
  const toggle = page.getByRole("button", { name: /^筛选/ });
  const list = page.getByRole("region", { name: "职位列表" });
  await expect(list.getByRole("listitem").first()).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);

  if (testInfo.project.name === "mobile") {
    await expect(panel).toBeHidden();
    await toggle.click();
    await expect(panel).toBeVisible();
    expect((await box(panel)).y).toBeLessThan((await box(list)).y);
    return;
  }

  await expect(toggle).toBeHidden();
  await expect(panel).toBeVisible();
  const filters = page.getByRole("complementary", { name: "筛选职位" });
  expect((await box(filters)).x + (await box(filters)).width).toBeLessThanOrEqual((await box(list)).x);

  await page.mouse.wheel(0, 1500);
  await expect.poll(async () => Math.round((await box(filters)).y)).toBe(72); // just below the 3.5rem header
});

test("job page: contact and share in a right column that stays in view on desktop, after the description on phones", async ({
  page,
}, testInfo) => {
  await page.goto("/jobs/j3");
  const description = page.getByRole("heading", { name: "Job description" });
  const contact = page.getByRole("region", { name: "联系方式" });
  const share = page.getByRole("region", { name: "分享给朋友" });
  const report = page.getByRole("button", { name: "举报这个职位" });
  await expect(contact).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);

  if (testInfo.project.name === "mobile") {
    expect((await box(contact)).y).toBeGreaterThan((await box(description)).y);
    expect((await box(share)).y).toBeGreaterThan((await box(contact)).y);
    expect((await box(report)).y).toBeGreaterThan((await box(share)).y);
    return;
  }

  expect((await box(contact)).x).toBeGreaterThan((await box(description)).x + (await box(description)).width);
  expect((await box(share)).x).toBe((await box(contact)).x);
  expect((await box(report)).x).toBeLessThan((await box(contact)).x); // report stays under the description

  await page.mouse.wheel(0, 2000);
  await expect.poll(async () => Math.round((await box(contact)).y)).toBeGreaterThanOrEqual(72);
  const viewport = page.viewportSize()!;
  expect((await box(contact)).y).toBeLessThan(viewport.height);
});
