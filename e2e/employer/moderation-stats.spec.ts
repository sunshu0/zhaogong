import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { MODERATOR_EMAIL, moderatorPage, openReportForm, publishJob, signUpEmployer, uniqueTitle } from "./helpers";
import { waitForTitle } from "../helpers/title";

// Round 19 pages pop in and fade (animate-pop-in, transitions): axe scans the settled page, as with "reduce motion",
// not one caught mid-animation with half-faded colours.
test.use({ reducedMotion: "reduce" });

// 审核数据 (#70, PRD R-34). Other specs report and take down jobs on the same server at the same time, so the
// numbers are compared as "at least one more", never exactly.

/** A number in the summary at the top of /admin. */
async function summary(admin: Page, label: string): Promise<number> {
  const cell = admin.getByLabel("审核数据：现在").locator("div").filter({ hasText: label });
  await expect(cell.locator("dd").first()).toHaveText(/^\d+$/);
  return Number(await cell.locator("dd").first().textContent());
}

/** This week's row of the 审核数据 tab: [新举报, 处理, 用时, 下架, 封禁]. */
async function thisWeek(admin: Page): Promise<string[]> {
  await admin.getByRole("tab", { name: /审核数据/ }).click();
  const row = admin.getByRole("row", { name: /^本周/ });
  await expect(row).toBeVisible();
  return (await row.getByRole("cell").allTextContents()).map((text) => text.trim());
}

test("审核数据: a report waits in the summary, and taking the job down counts in this week's row", async ({
  browser,
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);
  const id = await publishJob(page, title);

  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  const [reportedBefore, handledBefore, , takenDownBefore] = await thisWeek(admin);
  const weeks = admin.getByRole("table", { name: /最近 8 周每周/ });
  await expect(weeks.getByRole("row")).toHaveCount(9); // the header and eight weeks
  await waitForTitle(admin);
  expect(
    (await new AxeBuilder({ page: admin }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations,
  ).toEqual([]);

  await page.goto(`/jobs/${id}`);
  await openReportForm(page);
  await page.getByRole("group", { name: "举报这个职位" }).getByLabel("收押金 / 介绍费").check();
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");

  await admin.reload();
  // Not openBefore + 1: specs running beside this one close their own reports meanwhile, so the total can drop.
  // The report itself is checked in 被举报 below.
  expect(await summary(admin, "未处理的举报")).toBeGreaterThanOrEqual(1);
  await expect(admin.getByLabel("审核数据：现在")).toContainText("最早的等了");
  // This week's 新举报 only grows, so it must count this report (#90).
  expect(Number((await thisWeek(admin))[0])).toBeGreaterThanOrEqual(Number(reportedBefore) + 1);

  await admin.getByRole("tab", { name: /被举报/ }).click();
  const card = admin.getByRole("article").filter({ has: admin.getByRole("heading", { name: title }) });
  await card.getByRole("button", { name: "下架" }).click();
  await expect(card).toHaveCount(0);

  const [, handled, time, takenDown] = await thisWeek(admin);
  expect(Number(handled)).toBeGreaterThanOrEqual(Number(handledBefore) + 1);
  expect(Number(takenDown)).toBeGreaterThanOrEqual(Number(takenDownBefore) + 1);
  expect(time).not.toBe("—");
  // The take-down is the demo moderator's, in 按审核员 (#60 names who acted).
  await expect(admin.getByRole("row", { name: new RegExp(`^${MODERATOR_EMAIL}`) })).toBeVisible();
  await admin.screenshot({ path: testInfo.outputPath("moderation-stats.png"), fullPage: true });
  await admin.context().close();
});

test("审核数据's 漏斗 shows the four flows' steps, for 7 or 30 days, split by language or identity (#316)", async ({
  page,
  browser,
}, testInfo) => {
  // An employer opens the posting page: post_view is recorded for this visitor and day.
  await signUpEmployer(page, testInfo);
  await page.goto("/employer/post");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: /审核数据/ }).click();
  const post = admin.getByRole("region", { name: "雇主：发布职位" });
  await expect(post.getByRole("rowheader", { name: "打开发布页" })).toBeVisible();
  for (const flow of ["求职：从职位到联系雇主", "求职：外部职位", "登录"]) {
    await expect(admin.getByRole("region", { name: flow })).toBeVisible();
  }
  // Counts only: a step with visitors reads a number of 5 or more, or 少于 5.
  await expect(post.getByRole("row", { name: /^打开发布页/ })).toContainText(/少于 5|\d/);

  await admin.getByRole("radio", { name: "最近 30 天" }).check();
  await admin.getByRole("radio", { name: "按身份" }).check();
  await expect(post.getByRole("columnheader", { name: "雇主" })).toBeVisible();
  await expect(post.getByRole("columnheader", { name: "未登录" })).toBeVisible();
  await admin.getByRole("radio", { name: "按语言" }).check();
  await expect(post.getByRole("columnheader", { name: "中文页面" })).toBeVisible();

  await waitForTitle(admin);
  const { violations } = await new AxeBuilder({ page: admin }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
  await admin.context().close();
});
