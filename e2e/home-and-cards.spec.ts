import { expect, test, type Locator, type Page } from "@playwright/test";

// User feedback 8 (10-30): on a 375 × 812 phone the home page's jobs come before the features, and a job card's
// hours and shifts come before the contact, none of them cut. The numbers go to the log (FB8: …), so the same spec
// measures main before the change and the branch after it (#featured is the jobs band's id on both).

const box = async (locator: Locator) => (await locator.boundingBox())!;

/** The job cards of the job list, by id. */
const card = (page: Page, id: string) =>
  page
    .getByRole("region", { name: "职位列表" })
    .locator("article")
    .filter({ has: page.locator(`a[href="/jobs/${id}"]`) });

test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== "mobile", "the phone's screen"));

test("FB8: the home page's first job card, and what is above it", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const first = page.locator("#featured article").first();
  await expect(first).toBeVisible();
  const cardY = Math.round((await box(first)).y);
  const featuresY = Math.round((await box(page.getByRole("region", { name: "功能展示" }))).y);
  console.log(`FB8: 375x812 home: first job card at ${cardY} px; 功能展示 at ${featuresY} px`);
  await page.screenshot({ path: testInfo.outputPath("fb8-home-375.png"), fullPage: true });
  // The jobs come before what the site does.
  expect(cardY).toBeLessThan(featuresY);
  // The AI chat post is in the employer band.
  await expect(
    page.getByRole("region", { name: "招人？一分钟发布招聘" }).getByRole("article", { name: "AI 对话发帖" }),
  ).toBeAttached();
});

test("FB8: job cards on a 375 px phone show the hours and the shifts, and the contact after them", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/jobs");
  const list = page.getByRole("region", { name: "职位列表" });
  await expect(list.locator("article").first()).toBeVisible();
  const firstY = Math.round((await box(list.locator("article").first())).y);
  const heights: string[] = [];
  let bottom = firstY;
  for (const id of ["j3", "j5", "j11"]) {
    const { height } = await box(card(page, id));
    heights.push(`${id} ${Math.round(height)}`);
    bottom += height;
  }
  await page.screenshot({ path: testInfo.outputPath("fb8-jobs-375.png") });
  console.log(
    `FB8: 375x812 /jobs: first card at ${firstY} px; ${heights.join(", ")}; three cards end at ${Math.round(bottom)} px`,
  );

  for (const [id, words] of [
    ["j1", ["小时/周", "周五至周日晚班", "聊天联系"]],
    ["j5", ["20–30 小时/周", "早班 7:00–13:00", "聊天联系"]],
    ["j20", ["10–16 小时/周", "周五至周日晚市，17:00–21:30", "聊天联系"]],
  ] as const) {
    const line = card(page, id).locator("p.flex-wrap");
    const lines = await line.evaluate((p) => {
      const tops = new Set([...p.children].map((point) => Math.round(point.getBoundingClientRect().top)));
      return tops.size;
    });
    console.log(`FB8: 375x812 ${id}: points on ${lines} line(s)`);
    for (const text of words) {
      const point = line.locator(":scope > span").filter({ hasText: text });
      // Inside the points box: a point pushed to a third line is hidden by the box.
      const [p, b] = [await box(point), await box(line)];
      expect(p.y + p.height, `${id}: ${text}`).toBeLessThanOrEqual(b.y + b.height + 1);
    }
    // The hours come before the contact.
    const text = (await line.textContent()) ?? "";
    expect(text.indexOf("小时/周"), id).toBeLessThan(text.indexOf("聊天联系"));
  }
});
