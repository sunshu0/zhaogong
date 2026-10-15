import { expect, test } from "@playwright/test";
import { DEMO_DATA, visibleStats } from "../src/config/landing";

test("landing: headline, search, quick filters, the open jobs counted, and three window notices", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle("找工 · 奥克兰的中文工作平台");
  const hero = page.getByRole("region", { name: /^奥克兰的中文工作/ });
  await expect(hero.getByRole("heading", { level: 1 })).toHaveText("奥克兰的中文工作，时薪写在最前面。");
  await expect(hero.getByRole("searchbox", { name: "搜索职位" })).toBeInViewport();
  await expect(hero.getByRole("button", { name: "找工作" })).toBeInViewport();
  const quick = hero.getByRole("list", { name: "快捷筛选" }).getByRole("link");
  await expect(quick).toHaveText(["接受学签", "包餐", "兼职", "市中心"]);
  await expect(quick.first()).toHaveAttribute("href", "/jobs?visa=student");
  await expect(hero.locator("[data-hero-counts]")).toHaveText(/^[\d,]+ 个职位在招，来自 [\d,]+ 家已验证雇主/);

  // 橱窗告示: three open jobs, each a link to its page with the pay large; turned on desktop, straight and
  // scrolling sideways on phones.
  const notices = hero.getByRole("list", { name: "正在招聘" }).getByRole("listitem");
  await expect(notices).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    await expect(notices.nth(i).getByRole("link")).toHaveAttribute("href", /^\/jobs\/[^/]+$/);
    await expect(notices.nth(i)).toContainText("/小时");
  }
  const turns = await notices.evaluateAll((items) => items.map((li) => getComputedStyle(li).rotate));
  const headline = (await hero.getByRole("heading", { level: 1 }).boundingBox())!;
  if (testInfo.project.name === "desktop") {
    expect(turns.every((turn) => turn !== "none" && turn !== "0deg")).toBe(true);
    // The headline is large on desktop (48–56 px), the notices on its right.
    const size = await hero
      .getByRole("heading", { level: 1 })
      .evaluate((h) => parseFloat(getComputedStyle(h).fontSize));
    expect(size).toBeGreaterThanOrEqual(48);
    expect(size).toBeLessThanOrEqual(56);
    expect((await notices.first().boundingBox())!.x).toBeGreaterThan(headline.x + headline.width);
    // The header's logo and the headline start at the same x: one site container.
    const headerLogo = (await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).boundingBox())!;
    expect(Math.abs(headerLogo.x - headline.x)).toBeLessThanOrEqual(1);
  } else {
    expect(turns.every((turn) => turn === "none" || turn === "0deg")).toBe(true);
    const list = hero.getByRole("list", { name: "正在招聘" });
    expect(await list.evaluate((ul) => ul.scrollWidth > ul.clientWidth)).toBe(true);
    expect((await notices.first().boundingBox())!.x).toBeCloseTo(16, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("landing: one line of numbers from the data, with the 演示数据 tag, in the page's HTML too (#51)", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const line = page.locator("[data-hero-counts]");
  const shown = visibleStats({ employersPosting: 0, jobsPosted: 0, hiresConfirmed: 0, contactViews: 0 })
    .filter((s) => s.key === "hiresConfirmed" || s.key === "contactViews")
    .map((s) => s.label);
  await expect(line).toHaveText(
    new RegExp(`^[\\d,]+ 个职位在招，来自 [\\d,]+ 家已验证雇主${shown.map((label) => ` · [\\d,]+ ${label}`).join("")}`),
  );
  if (DEMO_DATA) await expect(line.getByText("演示数据", { exact: true })).toBeVisible();
  // No second set of the same numbers further down.
  await expect(page.getByRole("region", { name: "平台数据" })).toHaveCount(0);

  // Rendered on the server: the HTML already carries the numbers (crawlers, share previews, no JavaScript).
  const html = await (await request.get("/")).text();
  expect(html).toMatch(/data-hero-counts=""[^>]*>(<[^b][^>]*>)*<b[^>]*>[\d,]+<\/b>/);
});

test("landing: features with the AI chat post, featured jobs, and the employer before → after", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const featured = page.getByRole("region", { name: "精选工作" });
  const cards = featured.getByRole("listitem").getByRole("link");
  await expect(cards).toHaveCount(6);
  for (const href of await cards.evaluateAll((links) => links.map((a) => a.getAttribute("href")))) {
    expect(href).toMatch(/^\/jobs\/j\d+$/);
  }
  await expect(featured.getByText("未验证")).toHaveCount(0);

  const features = page.getByRole("region", { name: "功能展示" });
  const ai = features.getByRole("article", { name: "AI 对话发帖" });
  await expect(ai).toBeVisible();
  const others = features.getByRole("heading", { level: 3 });
  await expect(others).toHaveText(["AI 对话发帖", "发布前合规检查", "雇主验证与防骗", "中文为主"]);

  if (testInfo.project.name === "desktop") {
    const titles = featured.locator("li h3");
    const ys = await Promise.all([0, 1, 2, 3].map(async (i) => Math.round((await titles.nth(i).boundingBox())!.y)));
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
    // The AI chat post on the left, the three other features beside it.
    const aiBox = (await ai.boundingBox())!;
    const firstOther = (await features.getByRole("heading", { level: 3, name: "发布前合规检查" }).boundingBox())!;
    expect(firstOther.x).toBeGreaterThan(aiBox.x + aiBox.width);
  }

  const employer = page.getByRole("region", { name: "招人？一分钟发布招聘" });
  await expect(employer.getByText("【急招】Mt Eden 川菜馆招前厅服务员 2 名", { exact: false })).toBeVisible();
  const after = employer.getByRole("figure");
  for (const text of ["前厅服务员", "Front-of-house staff", "$25–27/小时", "接受学签", "联系方式：登录后可见"]) {
    await expect(after).toContainText(text);
  }
  await expect(employer.getByRole("link", { name: "注册雇主 →" })).toHaveAttribute(
    "href",
    "/login?role=employer&next=%2Femployer%2Fpost",
  );
  await expect(employer.getByRole("link", { name: "看看雇主能做什么" })).toHaveAttribute("href", "/employer");

  await cards.first().click();
  await expect(page).toHaveURL(/\/jobs\/j\d+$/);
  await page.goBack();
  await featured.getByRole("link", { name: "查看全部职位 →" }).click();
  await expect(page).toHaveURL("/jobs");
});

test("the search box opens the job list for the keyword", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("region", { name: /^奥克兰的中文工作/ })
    .getByRole("searchbox", { name: "搜索职位" })
    .fill("点心");
  await page
    .getByRole("region", { name: /^奥克兰的中文工作/ })
    .getByRole("button", { name: "找工作" })
    .click();
  await expect(page).toHaveURL("/jobs?q=%E7%82%B9%E5%BF%83");
  await expect(page.getByRole("main").getByRole("heading", { level: 2, name: "点心师傅" })).toBeVisible();
  await expect(page.getByRole("link", { name: "去掉条件：“点心”" })).toBeVisible();
});

test("a quick filter opens the filtered job list; the logo leads back to the intro", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("region", { name: /^奥克兰的中文工作/ })
    .getByRole("link", { name: "包餐" })
    .click();
  await expect(page).toHaveURL("/jobs?meals=1");
  await expect(page.getByRole("heading", { level: 1, name: "奥克兰中文工作" })).toBeVisible();
  await expect(page.getByRole("link", { name: "去掉条件：包餐" })).toBeVisible();
  await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { level: 1, name: /^奥克兰的中文工作/ })).toBeVisible();
});
