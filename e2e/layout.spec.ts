import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const box = async (locator: Locator) => (await locator.boundingBox())!;
const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test("job rows: title, pay, employer, 地区 and 工时 and up to 3 tags, at least 3 per phone screen", async ({
  page,
}, testInfo) => {
  const widths = testInfo.project.name === "desktop" ? [1280, 1440, 1920] : [375];
  for (const width of widths) {
    const height = testInfo.project.name === "mobile" ? 812 : 900;
    await page.setViewportSize({ width, height });
    await page.goto("/jobs");
    const list = page.getByRole("region", { name: "职位列表" });
    const cards = list.locator("article");
    await expect(cards.first()).toBeVisible();
    const first = await box(cards.nth(0));
    const second = await box(cards.nth(1));
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    expect(second.x).toBe(first.x);
    expect(first.width).toBeCloseTo((await box(list)).width, 0);
    // A21: at least three whole rows on a 375 × 812 phone, below the header, search and count. Measured on three
    // demo jobs: other specs publish jobs with long titles that come first while the suite runs.
    if (width === 375) {
      let bottom = first.y;
      for (const id of ["j3", "j5", "j11"])
        bottom += (await box(cards.filter({ has: page.locator(`a[href="/jobs/${id}"]`) }))).height;
      expect(bottom).toBeLessThanOrEqual(height);
    }

    const retail = cards.filter({ has: page.locator('a[href="/jobs/j5"]') });
    // Only the title is a link (stretched over the card), so its name is the title alone.
    await expect(retail.getByRole("link")).toHaveCount(1);
    await expect(retail.getByRole("link")).toHaveAccessibleName("超市理货员");
    for (const text of [
      "超市理货员",
      "Supermarket shelf stacker",
      "$24/小时",
      "东区亚洲超市",
      "已验证企业",
      "聊天交换联系方式", // A25: j5 keeps contact details private
      "每周 20–30 小时",
    ])
      await expect(retail).toContainText(text);
    // The rest is on the job page: summary, shifts, languages, visas, "未注明", employer id, activity.
    for (const text of ["上货、整理货架", "早班 7:00", "工作语言", "雇主接受的签证", "未注明", "雇主ID", "今日已回复"])
      await expect(retail).not.toContainText(text);
    await expect(retail).not.toContainText("021 555");
    for (let i = 0; i < (await cards.count()); i += 1)
      expect(await cards.nth(i).locator("li").count()).toBeLessThanOrEqual(3);
    const sizes = await retail.evaluate((card) =>
      [...card.querySelectorAll("*")].map(
        (el) => [el.textContent?.trim(), parseFloat(getComputedStyle(el).fontSize)] as const,
      ),
    );
    // Pay (#36) is a large figure with a small 「/小时」 after it: the figure is what must be biggest.
    const payTexts = ["$24/小时", "$24", "/小时"];
    const pay = sizes.find(([text]) => text === "$24")![1];
    expect(Math.max(...sizes.filter(([text]) => !payTexts.includes(text!)).map(([, size]) => size))).toBeLessThan(pay);

    expect(await noSideScroll(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`job-cards-${width}.png`) });
  }
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
});

test("the whole card opens the job, and featured cards on the home page are h3 under 精选工作", async ({ page }) => {
  await page.goto("/jobs");
  const card = page.getByRole("region", { name: "职位列表" }).locator("article").first();
  await expect(card.getByRole("heading", { level: 2 })).toBeVisible();
  const { x, y, width, height } = await box(card);
  await page.mouse.click(x + width - 12, y + height - 12); // a corner far from the title
  await expect(page).toHaveURL(/\/jobs\/j\d+$/);

  await page.goto("/");
  const featured = page.locator("#featured");
  await expect(featured.getByRole("heading", { level: 2, name: "精选工作" })).toBeVisible();
  await expect(featured.locator("article").first().getByRole("heading", { level: 3 })).toBeVisible();
  await expect(featured.locator("article h2")).toHaveCount(0);
});

test("mobile header and bottom bar actions have touch-sized targets", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Touch target check only applies to the phone layout");
  await page.goto("/");
  // Signed out: 发布招聘 in the header, then 职位 · 聊天 · 我的 at the bottom.
  const controls = page
    .locator('header a:not([href="/"]), header button, nav[aria-label="底部导航"] a')
    .filter({ visible: true });
  await expect(controls).toHaveCount(4);
  // Polled: the header is drawn again once the page has asked the server about the session, and a control
  // measured just then has no box.
  for (let i = 0; i < (await controls.count()); i += 1) {
    await expect
      .poll(async () => (await controls.nth(i).boundingBox())?.height ?? 0, { message: `control ${i + 1} of 4` })
      .toBeGreaterThanOrEqual(44);
  }
});

test("job list below 1024 px: filters collapsed in one bar; Esc or a tap outside closes them unapplied", async ({
  page,
}, testInfo) => {
  // Phones, and tablets in the desktop project; from 1024 px the filters are a column (next test).
  if (testInfo.project.name === "desktop") await page.setViewportSize({ width: 900, height: 900 });
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

test("job list from 1024 px: the filters are a 240 px column left of the list, and a change applies at once", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The filter column is a desktop layout");
  await page.goto("/jobs?industry=hospitality");
  const panel = page.locator("#job-filters");
  const list = page.getByRole("region", { name: "职位列表" });
  await expect(list.getByRole("listitem").first()).toBeVisible();
  await expect(panel).toBeVisible();
  await expect(page.getByRole("button", { name: /^筛选/ })).toBeHidden();
  await expect(page.getByRole("button", { name: "查看职位" })).toBeHidden();

  const [column, rows] = [await box(panel), await box(list)];
  expect(column.width).toBeCloseTo(240, 0);
  expect(column.x + column.width).toBeLessThan(rows.x);
  expect(rows.width).toBeLessThanOrEqual(720);
  expect(Math.abs(column.y - (await box(page.getByRole("searchbox", { name: "搜索职位" }))).y)).toBeLessThan(4);
  expect(await noSideScroll(page)).toBe(true);

  // Plain checkboxes; ticking one applies it, keeping the others.
  const albany = page.getByRole("group", { name: "地区" }).getByLabel("Albany");
  await albany.check();
  await expect(page).toHaveURL(/region=akl-albany/);
  await expect(page).toHaveURL(/industry=hospitality/);
  await expect(page.getByRole("group", { name: "地区" }).getByLabel("Albany")).toBeChecked();
  await expect(page.getByRole("link", { name: "去掉条件：Albany" })).toBeVisible();
});

test("job page: contact in a right column that stays in view on desktop, after the description on phones", async ({
  page,
}, testInfo) => {
  await page.goto("/jobs/j3");
  const description = page.getByRole("heading", { name: "职位描述" });
  const contact = page.getByRole("region", { name: "联系方式" });
  const report = page.getByRole("button", { name: "举报这个职位" });
  await expect(contact).toBeVisible();
  // Enabled once the page has hydrated: before that the button is a placeholder that gets replaced.
  await expect(report).toBeEnabled();
  expect(await noSideScroll(page)).toBe(true);

  if (testInfo.project.name === "mobile") {
    expect((await box(contact)).y).toBeGreaterThan((await box(description)).y);
    expect((await box(report)).y).toBeGreaterThan((await box(contact)).y);
    return;
  }

  expect((await box(contact)).x).toBeGreaterThan((await box(description)).x + (await box(description)).width);
  expect((await box(report)).x).toBeLessThan((await box(contact)).x); // report stays under the description

  await page.mouse.wheel(0, 2000);
  await expect.poll(async () => Math.round((await box(contact)).y)).toBeGreaterThanOrEqual(72);
  const viewport = page.viewportSize()!;
  expect((await box(contact)).y).toBeLessThan(viewport.height);
});

test("job page facts first: pay, region, hours, type, meals, visas; share is a button; actions sit above the bottom bar", async ({
  page,
}, testInfo) => {
  await page.goto("/jobs/j1"); // contact details public
  const facts = page.locator("article header dl").filter({ visible: true });
  await expect(facts.locator("dt")).toHaveText(["薪资", "地区", "工时和班次", "用工形式", "食宿", "接受的签证"]);
  // Facts in the first row share its top edge (the computed grid template can still read "repeat(2, …)").
  const columns = await facts.evaluate((dl) => {
    const tops = [...dl.querySelectorAll("dt")].map((dt) => Math.round(dt.getBoundingClientRect().top));
    return tops.filter((top) => top === tops[0]).length;
  });
  expect(columns).toBe(testInfo.project.name === "mobile" ? 2 : 3);

  await page.getByRole("button", { name: "分享" }).click();
  await expect(page.getByRole("dialog", { name: "分享给朋友" })).toBeVisible();
  await page.keyboard.press("Escape");

  const chat = page.getByRole("main").getByRole("link", { name: "立即沟通", exact: true });
  const contactLink = page.getByRole("link", { name: "查看联系方式", exact: true });
  await expect(chat).toBeVisible();
  await expect(contactLink).toBeVisible();
  if (testInfo.project.name === "mobile") {
    // Fixed above the bottom navigation, and the end of the page can scroll clear of it.
    const nav = await box(page.getByRole("navigation", { name: "底部导航" }));
    const bar = await box(chat);
    expect(bar.y + bar.height).toBeLessThanOrEqual(nav.y);
    await page.mouse.wheel(0, 5000);
    const report = page.getByRole("button", { name: "举报这个职位" });
    await expect.poll(async () => (await box(report)).y + (await box(report)).height).toBeLessThanOrEqual(bar.y);
  }
  await contactLink.click();
  await expect(page).toHaveURL("/jobs/j1#contact");

  await page.goto("/jobs/j2"); // contact details exchanged in the chat
  await expect(page.getByRole("main").getByRole("link", { name: "立即沟通", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "查看联系方式", exact: true })).toHaveCount(0);
  expect(await noSideScroll(page)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("job-page.png"), fullPage: true });
});
