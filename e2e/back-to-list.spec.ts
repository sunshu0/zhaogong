import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openFromList } from "./helpers";

// 操作手感第三件 (#409, ADR 0047): back from a job, the list is where it was, with the browser's back and with
// 「← 职位列表」; a job that has gone falls back to the old scroll position; a new visit starts at the top.
test.use({ reducedMotion: "reduce" });

const cards = (page: Page) => page.locator('article a[href^="/jobs/j"]').filter({ visible: true });

/** Where the card holding a link to `href` sits from the top of the window, and the page's scroll. */
function place(page: Page, href: string) {
  return page.evaluate((href) => {
    const link = [...document.querySelectorAll<HTMLAnchorElement>(`article a[href="${href}"]`)].find(
      (a) => a.getClientRects().length > 0,
    );
    const top = link?.closest("article")?.getBoundingClientRect().top;
    return { scrollY: Math.round(scrollY), top: top === undefined ? null : Math.round(top) };
  }, href);
}

/** On /jobs, the tenth card (or the last, with fewer jobs) scrolled to the middle of the window. */
async function aCardFarDown(page: Page, project: string) {
  if (project === "desktop") await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/jobs");
  await expect(cards(page).first()).toBeVisible(); // the list streams in after the page
  const count = await cards(page).count();
  expect(count, "enough jobs to scroll").toBeGreaterThanOrEqual(4);
  const link = cards(page).nth(Math.min(9, count - 1));
  await link.evaluate((a) => a.closest("article")!.scrollIntoView({ block: "center" }));
  const href = (await link.getAttribute("href"))!;
  const before = await place(page, href);
  expect(before.scrollY, "the list is scrolled").toBeGreaterThan(0);
  return { link, href, before };
}

async function backToTheList(page: Page, how: "browser back" | "← link") {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  if (how === "browser back") await page.goBack();
  else await page.getByRole("link", { name: "职位列表" }).click();
  await expect(page).toHaveURL(/\/jobs$/);
}

for (const how of ["browser back", "← link"] as const) {
  test(`into a job far down the list and ${how}: the list is where it was`, async ({ page }, info) => {
    const { link, href, before } = await aCardFarDown(page, info.project.name);
    await openFromList(page, link);
    await backToTheList(page, how);
    await expect(cards(page).and(page.locator(`[href="${href}"]`))).toBeInViewport();
    await expect.poll(async () => (await place(page, href)).top).toBeCloseTo(before.top!, -1);
  });
}

test("a job no longer in the list: 「← 职位列表」 keeps the old scroll position", async ({ page }, info) => {
  const { link, href, before } = await aCardFarDown(page, info.project.name);
  await openFromList(page, link);
  // As if the job had closed while it was open: the list comes back without its card.
  await page.addStyleTag({ content: `article:has(a[href="${href}"]) { display: none !important; }` });
  await backToTheList(page, "← link");
  // Within a header's height: the phone's header folds away as the page scrolls.
  await expect.poll(() => page.evaluate(() => Math.round(scrollY)), { timeout: 8_000 }).toBeCloseTo(before.scrollY, -2);
});

test("a new visit to the list starts at the top", async ({ page }, info) => {
  const { link } = await aCardFarDown(page, info.project.name);
  await openFromList(page, link);
  // The site's navigation (the bottom bar on a phone, the header from 1024 px), not the page's back link.
  await page.locator('nav a[href="/jobs"]').filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/jobs$/);
  // At the top: Next brings the page's own segment into view, under the header, so the first card shows.
  await expect(cards(page).first()).toBeInViewport();
  expect(await page.evaluate(() => scrollY)).toBeLessThan(200);
  await expect.poll(async () => (await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("an external job's 「← 专业职位」 goes back to the place in the list", async ({ page }, info) => {
  // A short window, so the section's few demo jobs scroll.
  await page.setViewportSize({ width: info.project.name === "desktop" ? 1280 : 375, height: 480 });
  await page.goto("/professional");
  const links = page.locator('article a[href^="/external/"]').filter({ visible: true });
  await expect(links.first()).toBeVisible();
  const count = await links.count();
  test.skip(count < 2, "too few external jobs to scroll");
  const link = links.nth(Math.min(9, count - 1));
  await link.evaluate((a) => a.closest("article")!.scrollIntoView({ block: "center" }));
  const href = (await link.getAttribute("href"))!;
  const before = await link.evaluate((a) => Math.round(a.closest("article")!.getBoundingClientRect().top));
  test.skip(before <= 0 || (await page.evaluate(() => scrollY)) === 0, "the list does not scroll");
  await link.click();
  await expect(page).toHaveURL(href);
  await page.getByRole("link", { name: "← 专业职位" }).click();
  await expect(page).toHaveURL(/\/professional$/);
  const card = page.locator(`article:has(a[href="${href}"])`).filter({ visible: true });
  await expect(card).toBeInViewport();
  await expect
    .poll(() => card.evaluate((article) => Math.round(article.getBoundingClientRect().top)))
    .toBeCloseTo(before, -1);
});
