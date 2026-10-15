import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { freshEmail, openWorkspacePage, signIn } from "./helpers";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

// 职位提醒 (#53, PRD R-29): save the list's filters, hear about a new job that matches in 通知, manage the alerts.

test("a saved search tells the job seeker about a new matching job, once", async ({ page, browser }, testInfo) => {
  const title = uniqueTitle("提醒测试服务员", testInfo);
  const list = `/jobs?q=${encodeURIComponent(title)}`;

  // Signed out, the list offers sign-in and comes back to the same search.
  await page.goto(list);
  await expect(page.getByRole("link", { name: "登录后保存为提醒" })).toHaveAttribute(
    "href",
    `/login?next=${encodeURIComponent(list)}`,
  );
  await signIn(page, list, freshEmail("alerts"));
  await page.getByRole("button", { name: "保存为提醒" }).click();
  await expect(page.getByRole("status").filter({ hasText: "已保存为提醒" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("alert-saved.png") });
  await page.reload();
  await page.getByRole("button", { name: "保存为提醒" }).click();
  await expect(page.getByRole("status").filter({ hasText: "已经是提醒了" })).toBeVisible();
  await page.goto("/workspace"); // its notifications are loaded now, before the job exists

  // An employer in another browser publishes a job the search finds.
  const boss = await browser.newContext({ ...testInfo.project.use });
  const bossPage = await boss.newPage();
  await signUpEmployer(bossPage, testInfo);
  const jobId = await publishJob(bossPage, title);
  expect(jobId).toBeTruthy();
  await boss.close();

  await openWorkspacePage(page, "通知"); // without a reload: the page asks the server again

  const notifications = page.getByRole("region", { name: "通知列表" });
  const found = notifications.getByRole("link", { name: new RegExp(`有新职位符合提醒.*${title}`) });
  await expect(found).toHaveCount(1);
  await expect(notifications).toContainText("3 条未读"); // the two demo ones and this
  await page.screenshot({ path: testInfo.outputPath("alert-notification.png"), fullPage: true });
  await found.click();
  await expect(page).toHaveURL(`/jobs/${jobId}`);
  await page.goto("/notifications");
  await expect(notifications).toContainText("2 条未读");
});

test("alerts can be renamed, paused and deleted in 我的", async ({ page }, testInfo) => {
  await signIn(page, "/jobs?industry=cleaning&meals=1", freshEmail("alerts.manage"));
  await page.getByRole("button", { name: "保存为提醒" }).click();
  await page.getByRole("status").getByRole("link", { name: "管理提醒" }).click();
  await expect(page).toHaveURL("/me/alerts");

  const alert = page.getByRole("article", { name: "提醒：清洁、包餐" });
  await expect(alert).toContainText("清洁 · 包餐");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);

  await alert.getByRole("button", { name: "改名" }).click();
  await page.getByLabel("提醒名称").fill("包餐清洁工");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  const renamed = page.getByRole("article", { name: "提醒：包餐清洁工" });
  await renamed.getByRole("button", { name: "暂停" }).click();
  await expect(renamed).toContainText("已暂停");
  await page.reload();
  await expect(renamed).toContainText("已暂停");
  await page.screenshot({ path: testInfo.outputPath("alerts.png"), fullPage: true });

  await renamed.getByRole("button", { name: "恢复提醒" }).click();
  await expect(renamed).not.toContainText("已暂停");
  await renamed.getByRole("link", { name: "看职位" }).click();
  await expect(page).toHaveURL("/jobs?industry=cleaning&meals=1");

  await page.goBack();
  await renamed.getByRole("button", { name: "删除" }).click();
  await renamed.getByRole("button", { name: "确认删除" }).click();
  await expect(page.getByText("还没有职位提醒")).toBeVisible();
});
