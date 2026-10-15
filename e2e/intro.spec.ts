import { expect, test } from "@playwright/test";
import { DEMO_DATA, visibleStats } from "../src/config/landing";

test("landing: hero with logo, headline, buttons and trust row; height by content", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page).toHaveTitle("找工 · 奥克兰的中文工作平台");
  const hero = page.getByRole("region", { name: "奥克兰的中文工作平台" });
  await expect(hero.locator('img[src*="icon-192"]')).toBeVisible();
  await expect(hero.getByText("找工", { exact: true })).toBeVisible();
  await expect(hero.getByRole("heading", { level: 1, name: "奥克兰的中文工作平台" })).toBeVisible();
  await expect(hero.getByRole("link", { name: "注册找工作" })).toBeInViewport();
  await expect(hero.getByRole("link", { name: "注册找工作" })).toHaveAttribute("href", "/login?role=seeker");
  // The quieter way in for employers (signed out: employer sign-up, then posting).
  await expect(hero.getByRole("link", { name: "我要招人 →" })).toHaveAttribute(
    "href",
    "/login?role=employer&next=%2Femployer%2Fpost",
  );
  await expect(hero.getByRole("link", { name: "直接浏览工作" })).toBeInViewport();
  await expect(hero.getByRole("list", { name: "我们的承诺" }).getByRole("listitem")).toHaveText([
    "雇主验证",
    "发布前查合规",
    "对求职者免费",
  ]);

  const height = (await hero.boundingBox())!.height;
  if (testInfo.project.name === "desktop") {
    expect(height).toBeGreaterThanOrEqual(520);
    expect(height).toBeLessThanOrEqual(680);
    // The headline is large on desktop (48–56 px).
    const size = await hero
      .getByRole("heading", { level: 1 })
      .evaluate((h) => parseFloat(getComputedStyle(h).fontSize));
    expect(size).toBeGreaterThanOrEqual(48);
    expect(size).toBeLessThanOrEqual(56);
    // The header's logo and the hero's content start at the same x: one site container.
    const headerLogo = (await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).boundingBox())!;
    const heroLogo = (await hero.locator("img").boundingBox())!;
    expect(Math.abs(headerLogo.x - heroLogo.x)).toBeLessThanOrEqual(1);

    // The stacked cards on the right overlap only at their edges: each card starts below the last line
    // (tags or facts) of the card above it.
    const stack = hero.locator("[data-job-stack] > div");
    await expect(stack).toHaveCount(3);
    for (let i = 0; i < 2; i++) {
      const lastLine = (await stack.nth(i).locator(":scope > *").last().boundingBox())!;
      const next = (await stack.nth(i + 1).boundingBox())!;
      expect(next.y, `card ${i + 2} covers card ${i + 1}`).toBeGreaterThanOrEqual(lastLine.y + lastLine.height);
    }
  } else {
    expect(height).toBeLessThan(page.viewportSize()!.height); // no empty first screen on phones
  }
});

test("landing: stats band with real counts and the 演示数据 tag", async ({ page }, testInfo) => {
  await page.goto("/");
  const stats = page.getByRole("region", { name: "平台数据" });
  const shown = visibleStats({ employersPosting: 0, jobsPosted: 0, hiresConfirmed: 0, contactViews: 0 });
  const cells = stats.getByRole("definition");
  if (DEMO_DATA) {
    await expect(stats.getByText("演示数据", { exact: true })).toBeVisible();
    await expect(cells).toHaveCount(shown.length);
    await expect(stats.getByRole("term")).toHaveText(shown.map((s) => s.label));
  }
  // Screen readers get the real number only; the counting digits are aria-hidden.
  for (const cell of await cells.all()) {
    await expect(cell.locator(".sr-only")).toHaveText(/^\d{1,3}(,\d{3})*$/);
    await expect(cell.locator("[data-count-up]")).toHaveAttribute("aria-hidden", "true");
  }

  const tops = await Promise.all((await cells.all()).map(async (c) => Math.round((await c.boundingBox())!.y)));
  if (testInfo.project.name === "desktop")
    expect(new Set(tops).size).toBe(1); // one row of four
  else expect(new Set(tops).size).toBe(2); // 2 × 2
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

test("注册找工作 goes through 注册或登录 and lands on the job list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "注册找工作" }).click();
  await expect(page).toHaveURL("/login?role=seeker");
  await expect(page.getByRole("radio", { name: /我要找工作/ })).toBeChecked();
  await expect(page.getByRole("heading", { level: 1, name: "注册或登录" })).toBeVisible();

  await page.getByLabel("邮箱", { exact: true }).fill(`new.seeker.${Date.now()}@example.com`);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByText("输入任意 6 位数字即可注册或登录").filter({ visible: true })).toBeVisible();
  await page.getByLabel("验证码").fill("135790");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs");
  await expect(page.getByRole("banner").getByRole("button", { name: "账号菜单，当前身份：求职者" })).toBeVisible();
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
