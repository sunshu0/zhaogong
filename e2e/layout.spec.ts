import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const box = async (locator: Locator) => (await locator.boundingBox())!;
const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("single-column job rows expose useful details without private contact data at all widths", async ({
  page,
}, testInfo) => {
  const widths = testInfo.project.name === "desktop" ? [1280, 1440, 1920] : [375];
  for (const width of widths) {
    await page.setViewportSize({ width, height: testInfo.project.name === "mobile" ? 812 : 900 });
    await page.goto("/jobs");
    const list = page.getByRole("region", { name: "职位列表" });
    const rows = list.locator('a[href^="/jobs/"]');
    await expect(rows.first()).toBeVisible();
    const first = await box(rows.nth(0));
    const second = await box(rows.nth(1));
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    expect(second.x).toBe(first.x);
    expect(first.width).toBeCloseTo((await box(list)).width, 0);
    const retail = list.locator('a[href="/jobs/j5"]');
    for (const text of [
      "上货、整理货架",
      "早班 7:00",
      "工作语言",
      "普通话",
      "雇主接受的签证",
      "打工度假",
      "每周 20–30 小时",
    ])
      await expect(retail).toContainText(text);
    await expect(retail.getByLabel("雇主招聘沟通情况", { exact: true })).toContainText(
      /最近在线：约 \d+ (分钟|小时)前在线/,
    );
    await expect(retail.getByLabel("雇主招聘沟通情况", { exact: true })).toContainText("今日已回复 3 位求职者");
    await expect(retail.getByLabel("雇主招聘沟通情况", { exact: true })).toContainText("演示状态");
    await expect(retail).not.toContainText("021 555");
    const noShift = list.locator('a[href="/jobs/j6"]');
    await expect(noShift.locator("dl > div").filter({ has: page.getByText("班次", { exact: true }) })).toContainText(
      "未注明",
    );
    expect(await noSideScroll(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`job-rows-${width}.png`) });
  }
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});

test("mobile header and bottom bar actions have touch-sized targets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Touch target check only applies to the phone layout");
  await page.goto("/");
  // Signed out: 发布招聘 in the header, then 职位 · 聊天 · 我的 at the bottom.
  const controls = page
    .locator('header a:not([href="/"]), header button, nav[aria-label="底部导航"] a')
    .filter({ visible: true });
  await expect(controls).toHaveCount(4);
  for (let i = 0; i < (await controls.count()); i += 1) {
    expect((await controls.nth(i).boundingBox())?.height, await controls.nth(i).innerText()).toBeGreaterThanOrEqual(44);
  }
});

test("job list: filters collapsed in one bar at every width; Esc or a tap outside closes them unapplied", async ({
  page,
}) => {
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

  // Job rows use the full width of the search bar at every viewport.
  const titles = list.getByRole("heading", { level: 2 });
  const [first, second] = [await box(titles.nth(0)), await box(titles.nth(1))];
  const grid = await box(list.locator("ul").first());
  expect(grid.width).toBeGreaterThan((await box(page.getByRole("search"))).width - 2);
  expect(second.y).toBeGreaterThan(first.y);
  expect(second.x).toBe(first.x);

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
