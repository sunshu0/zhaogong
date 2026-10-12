import { expect, test, type Locator, type Page } from "@playwright/test";

const box = async (locator: Locator) => (await locator.boundingBox())!;
const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("job list: filters collapsed in one bar at every width; Esc or a tap outside closes them unapplied", async ({
  page,
}, testInfo) => {
  await page.goto("/jobs?industry=hospitality");
  const panel = page.locator("#job-filters");
  const toggle = page.getByRole("button", { name: "筛选 · 1" });
  const list = page.getByRole("region", { name: "职位列表" });
  const search = page.getByRole("searchbox", { name: "搜索职位" });
  await expect(list.getByRole("listitem").first()).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);

  // Closed by default; the active filter shows as a chip under the bar; search and 筛选 share one row.
  await expect(panel).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("link", { name: "去掉条件：餐饮" })).toBeVisible();
  expect(Math.abs((await box(search)).y - (await box(toggle)).y)).toBeLessThan(4);

  // The list takes the full width of the bar: two columns of cards on desktop, one on phones.
  const titles = list.getByRole("heading", { level: 2 });
  const [first, second] = [await box(titles.nth(0)), await box(titles.nth(1))];
  const grid = await box(list.locator("ul").first());
  expect(grid.width).toBeGreaterThan((await box(page.getByRole("search"))).width - 2);
  if (testInfo.project.name === "desktop") {
    expect(second.y).toBe(first.y);
    expect(second.x).toBeGreaterThan(first.x + grid.width / 3);
  } else {
    expect(second.y).toBeGreaterThan(first.y);
  }

  // Opens as a drop-down over the list; Esc closes it and puts focus back on 筛选.
  await toggle.click();
  await expect(panel).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect((await box(panel)).y).toBeGreaterThan((await box(toggle)).y);
  await expect(page.getByRole("button", { name: "查看职位" })).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();

  // A tap outside closes it and drops choices that were not applied.
  await toggle.click();
  await page.getByRole("group", { name: "地区" }).getByText("Albany", { exact: true }).click();
  await expect(page.getByRole("group", { name: "地区" }).getByLabel("Albany")).toBeChecked();
  await page.getByRole("heading", { name: "奥克兰中文工作" }).click();
  await expect(panel).toBeHidden();
  await expect(page).toHaveURL("/jobs?industry=hospitality");
  await toggle.click();
  await expect(page.getByRole("group", { name: "地区" }).getByLabel("Albany")).not.toBeChecked();
  await expect(page.getByRole("group", { name: "行业" }).getByLabel("餐饮")).toBeChecked();
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
