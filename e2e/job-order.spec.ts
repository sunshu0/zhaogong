import { expect, test, type Page } from "@playwright/test";
import { expectProfileSaved, freshEmail, openFromList, signIn } from "./helpers";
import { signUpEmployer } from "./employer/helpers";
import { useEnglish } from "./helpers/english";

test.use({ reducedMotion: "reduce" });
const status = (page: Page) => page.locator("[data-job-order-status]");
const links = (page: Page) => page.getByRole("region", { name: "职位列表" }).locator("article a[href]");
/** The list's job links in order, once the list has streamed in (the order note comes first). */
async function listedIds(page: Page) {
  await expect(links(page).first()).toBeVisible();
  return links(page).evaluateAll((items) => items.map((a) => a.getAttribute("href")));
}

/**
 * The order is chosen in the filter form (review F1 补充裁定, A21): the desktop column applies a choice at once, the
 * phone's sheet on 查看职位. `check` only looks at the current choice, leaving the sheet open.
 */
async function chooseOrder(page: Page, desktop: boolean, label: string, check?: string) {
  const en = /^[A-Z]/.test(label);
  if (!desktop) await page.getByRole("button", { name: en ? /^Filters/ : /^筛选/ }).click();
  const order = page.getByRole("group", { name: en ? "Job order" : "职位排序", exact: true });
  if (check) await expect(order.getByLabel(check, { exact: true })).toBeChecked();
  await order.getByText(label, { exact: true }).click();
  await expect(order.getByLabel(label, { exact: true })).toBeChecked();
  if (!desktop) await page.getByRole("button", { name: en ? "Show jobs" : "查看职位", exact: true }).click();
}

async function preferDimSum(page: Page) {
  await page.goto("/profile");
  await page
    .getByRole("group", { name: "想做的岗位" })
    .getByRole("checkbox", { name: "点心面点", exact: true })
    .check();
  await expectProfileSaved(page);
  await expect(page.getByRole("checkbox", { name: "允许向雇主推荐我的主页" })).not.toBeChecked();
}

test("latest remains the default; recommended explains the signed-out fallback and preserves a sign-in return", async ({
  page,
}, info) => {
  const desktop = info.project.name === "desktop";
  await page.goto("/jobs?region=akl-mt-eden&type=part_time");
  await expect(links(page).first()).toBeVisible();
  // Nothing above the list but the filter chips and the count: the order is in the form (A21).
  await expect(page.getByRole("navigation", { name: "职位排序" })).toHaveCount(0);
  await chooseOrder(page, desktop, "推荐", "最新");
  await expect(page).toHaveURL("/jobs?region=akl-mt-eden&type=part_time&sort=recommended");
  await expect(status(page)).toHaveAttribute("data-job-order-status", "signed_out");
  await expect(page.getByRole("link", { name: "登录并返回" })).toHaveAttribute(
    "href",
    "/login?next=%2Fjobs%3Fregion%3Dakl-mt-eden%26type%3Dpart_time%26sort%3Drecommended",
  );
  await expect(page.getByRole("link", { name: "登录后保存为提醒" })).toHaveAttribute(
    "href",
    "/login?next=%2Fjobs%3Fregion%3Dakl-mt-eden%26type%3Dpart_time%26sort%3Drecommended",
  );
  await page.getByRole("link", { name: "Mt Eden / Dominion Rd，去掉这个条件" }).click();
  await expect(page).toHaveURL("/jobs?type=part_time&sort=recommended");
  // 清除 in the sheet clears the filters, not the order.
  if (!desktop) {
    await page.getByRole("button", { name: /^筛选/ }).click();
    await page.getByRole("button", { name: "清空条件", exact: true }).click();
    await expect(page.getByRole("group", { name: "职位排序", exact: true }).getByLabel("推荐")).toBeChecked();
    await page.getByRole("button", { name: "查看职位", exact: true }).click();
    await expect(page).toHaveURL("/jobs?sort=recommended");
  }
  await chooseOrder(page, desktop, "最新", "推荐");
  await expect(page).toHaveURL(desktop ? "/jobs?type=part_time" : "/jobs");
});

test("search, desktop filters or the phone sheet, and clearing empty results keep recommended", async ({
  page,
}, info) => {
  const desktop = info.project.name === "desktop";
  await page.goto("/jobs?sort=recommended");
  if (!desktop) await page.getByRole("button", { name: /^筛选/ }).click();
  await page.getByRole("button", { name: "行业", exact: true }).click();
  await page.getByRole("group", { name: "行业", exact: true }).getByText("餐饮", { exact: true }).click();
  await expect(
    page.getByRole("group", { name: "行业", exact: true }).getByLabel("餐饮", { exact: true }),
  ).toBeChecked();
  if (desktop) await expect(page).toHaveURL("/jobs?industry=hospitality&sort=recommended");
  await page.getByRole("button", { name: "食宿", exact: true }).click();
  await page.getByRole("group", { name: "食宿", exact: true }).getByText("包餐", { exact: true }).click();
  await expect(
    page.getByRole("group", { name: "食宿", exact: true }).getByLabel("包餐", { exact: true }),
  ).toBeChecked();
  if (!desktop) await page.getByRole("button", { name: "查看职位", exact: true }).click();
  await expect(page).toHaveURL("/jobs?industry=hospitality&meals=1&sort=recommended");
  if (!desktop) await expect(page.getByRole("button", { name: "筛选 · 2", exact: true })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "搜索职位" });
  await search.fill("没有这样的工作F1");
  await search.press("Enter");
  await expect(page).toHaveURL(/industry=hospitality&meals=1&q=.+&sort=recommended$/);
  await expect(page.getByText("暂时没有符合条件的职位", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "清除筛选，看全部职位", exact: true }).click();
  await expect(page).toHaveURL("/jobs?sort=recommended");
  await expect(links(page).first()).toBeVisible();
  await page.goto("/jobs?region=akl-mt-eden&type=part_time&sort=recommended");
  await page.getByRole("link", { name: "全部清除", exact: true }).click();
  await expect(page).toHaveURL("/jobs?sort=recommended");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("a private resume ranks only its owner's results; sign-out and a second account cannot reuse them", async ({
  page,
}, info) => {
  await signIn(page, "/jobs?sort=recommended", freshEmail("order.private"));
  await expect(status(page)).toHaveAttribute("data-job-order-status", "no_preferences");
  await preferDimSum(page);
  await page.getByLabel("称呼", { exact: true }).fill("F1_PRIVATE_NAME");
  await expectProfileSaved(page);
  await page.getByLabel("交换用电话", { exact: true }).fill("F1_PRIVATE_PHONE");
  await expectProfileSaved(page);
  const response = await page.goto("/jobs?sort=recommended");
  await expect(status(page)).toHaveAttribute("data-job-order-status", "recommended");
  const recommended = await listedIds(page);
  expect(recommended.indexOf("/jobs/j3")).toBeLessThan(recommended.indexOf("/jobs/j1"));
  const html = await response!.text();
  expect(html).not.toContain("F1_PRIVATE_NAME");
  expect(html).not.toContain("F1_PRIVATE_PHONE");
  expect(response!.headers()["cache-control"]).not.toMatch(/\bpublic\b|s-maxage/);
  const rsc = await page.request.get("/jobs?sort=recommended", { headers: { rsc: "1" } });
  expect(rsc.ok()).toBe(true);
  expect(await rsc.text()).not.toMatch(/F1_PRIVATE_(NAME|PHONE)/);
  expect(rsc.headers()["cache-control"]).not.toMatch(/\bpublic\b|s-maxage/);
  await chooseOrder(page, info.project.name === "desktop", "最新", "推荐");
  await expect(page).toHaveURL("/jobs");
  await expect(status(page)).toHaveCount(0);
  const latest = await listedIds(page);
  expect(latest.indexOf("/jobs/j1")).toBeLessThan(latest.indexOf("/jobs/j3"));
  await page.goto("/account");
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs");
  await page.goto("/jobs?sort=recommended");
  await expect(status(page)).toHaveAttribute("data-job-order-status", "signed_out");
  expect(await listedIds(page)).toEqual(latest);
  await signIn(page, "/jobs?sort=recommended", freshEmail("order.second"));
  await expect(status(page)).toHaveAttribute("data-job-order-status", "no_preferences");
  expect(await listedIds(page)).toEqual(latest);
});

test("switching between employer and seeker does not carry the private ranking across identities", async ({
  page,
}, info) => {
  await signUpEmployer(page, info, "/account");
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await expect(page).toHaveURL("/workspace");
  await preferDimSum(page);
  await page.goto("/jobs?sort=recommended");
  await expect(status(page)).toHaveAttribute("data-job-order-status", "recommended");
  await page.goto("/account");
  await page.getByRole("button", { name: /^切换为雇主/ }).click();
  await expect(page).toHaveURL("/workspace");
  await page.goto("/jobs?sort=recommended");
  await expect(status(page)).toHaveAttribute("data-job-order-status", "employer");
  await page.goto("/account");
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await expect(page).toHaveURL("/workspace");
  await page.goto("/jobs?sort=recommended");
  await expect(status(page)).toHaveAttribute("data-job-order-status", "recommended");
});

test("a preference with no match explains latest fallback, and English/home expose the ordering choices", async ({
  page,
  baseURL,
}, info) => {
  await signIn(page, "/profile", freshEmail("order.none"));
  await page.getByLabel("期望时薪（NZ$ / 小时起）").fill("200");
  await expectProfileSaved(page);
  await page.goto("/jobs?sort=recommended");
  await expect(status(page)).toHaveAttribute("data-job-order-status", "no_matches");
  await useEnglish(page, baseURL);
  await page.goto("/jobs?type=part_time&sort=recommended");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-NZ");
  await expect(status(page)).toContainText("latest order is kept");
  await chooseOrder(page, info.project.name === "desktop", "Latest", "Recommended");
  await expect(page).toHaveURL("/jobs?type=part_time");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Jobs for your preferences →", exact: true })).toHaveAttribute(
    "href",
    "/jobs?sort=recommended",
  );
});

test("without scripts, Chinese and English ordering links and native GET search retain filters and sort", async ({
  browser,
  page,
  baseURL,
}) => {
  for (const lang of ["zh", "en"] as const) {
    const context = await browser.newContext({ javaScriptEnabled: false, viewport: page.viewportSize() ?? undefined });
    try {
      if (lang === "en") await context.addCookies([{ name: "zg_lang", value: "en", url: baseURL! }]);
      const native = await context.newPage();
      await native.goto("/jobs?region=akl-mt-eden&type=part_time");
      const order = native.getByRole("navigation", { name: lang === "zh" ? "职位排序" : "Job order" });
      await order.getByRole("link", { name: lang === "zh" ? "推荐" : "Recommended", exact: true }).click();
      await expect(status(native)).toHaveAttribute("data-job-order-status", "signed_out");
      const search = native.getByRole("searchbox", { name: lang === "zh" ? "搜索职位" : "Search jobs" });
      await search.fill("服务员");
      await search.press("Enter");
      await expect
        .poll(() => {
          const query = new URL(native.url()).searchParams;
          return [query.get("region"), query.get("type"), query.get("q"), query.get("sort")];
        })
        .toEqual(["akl-mt-eden", "part_time", "服务员", "recommended"]);
      await expect(native.locator('article a[href="/jobs/j1"]')).toBeVisible();
      await native
        .getByRole("navigation", { name: lang === "zh" ? "职位排序" : "Job order" })
        .getByRole("link", { name: lang === "zh" ? "最新" : "Latest", exact: true })
        .click();
      expect(new URL(native.url()).searchParams.has("sort")).toBe(false);
      expect(new URL(native.url()).searchParams.get("q")).toBe("服务员");
    } finally {
      await context.close();
    }
  }
});

/** Opens a card part way down `query`'s list, comes back by `how`, and checks the same card is at the same height. */
async function returnKeepsPlace(page: Page, query: string, how: "browser back" | "list link") {
  await page.goto(query);
  await expect(links(page).first()).toBeVisible();
  const count = await links(page).count();
  const link = links(page).nth(Math.min(count - 1, 5));
  await link.evaluate((a) => a.closest("article")!.scrollIntoView({ block: "center" }));
  const href = (await link.getAttribute("href"))!;
  const top = await link.evaluate((a) => Math.round(a.closest("article")!.getBoundingClientRect().top));
  await openFromList(page, link);
  if (how === "browser back") await page.goBack();
  else await page.getByRole("link", { name: "职位列表", exact: true }).click();
  await expect(page).toHaveURL(query);
  const returned = page.locator(`article:has(a[href="${href}"])`).filter({ visible: true });
  await expect(returned).toBeInViewport();
  await expect.poll(() => returned.evaluate((a) => Math.round(a.getBoundingClientRect().top))).toBeCloseTo(top, -1);
}

for (const how of ["browser back", "list link"] as const) {
  test(`recommended detail return by ${how} keeps filter, sort and the card's position`, async ({ page }) => {
    await returnKeepsPlace(page, "/jobs?industry=hospitality&sort=recommended", how);
  });

  // Review F1 4: signed out, Recommended is the latest order; here the list a seeker comes back to is really reordered.
  test(`a seeker's reordered list: return by ${how} keeps the order and the card's position`, async ({ page }) => {
    await signIn(page, "/jobs", freshEmail("order.return"));
    await preferDimSum(page);
    await page.goto("/jobs");
    await expect(links(page).first()).toBeVisible();
    const latest = await listedIds(page);
    await page.goto("/jobs?sort=recommended");
    await expect(status(page)).toHaveAttribute("data-job-order-status", "recommended");
    await expect(links(page).first()).toBeVisible();
    const recommended = await listedIds(page);
    expect(recommended).not.toEqual(latest);
    expect([...recommended].sort()).toEqual([...latest].sort());
    await returnKeepsPlace(page, "/jobs?sort=recommended", how);
    expect(await listedIds(page)).toEqual(recommended);
  });
}
