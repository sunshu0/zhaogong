import { expect, test } from "@playwright/test";
import { cardMenuItem, publishJob, setJobClosing, signUpEmployer, uniqueTitle } from "./helpers";

// 职位快到期提醒、续期和重新发布 (#69, PRD R-33). The closing dates are moved in the dev server's database.

test("a job closing in 3 days shows in 待办 and 通知, under 将截止, and renewing pushes the date back", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("续期测试服务员", testInfo);
  const jobId = (await publishJob(page, title))!;
  expect(jobId).toBeTruthy();
  await setJobClosing(page, jobId, 2.5);

  await page.goto("/workspace");
  const todo = page.getByRole("link", { name: new RegExp(`「${title}」3 天后截止`) });
  await expect(todo).toBeVisible();
  await expect(todo).toHaveAttribute("href", "/employer/jobs?tab=ending");

  await page.goto("/notifications");
  const notice = page.getByRole("region", { name: "通知列表" }).getByRole("link", { name: new RegExp(title) });
  await expect(notice).toHaveCount(1);
  await notice.click();
  await expect(page).toHaveURL("/employer/jobs?tab=ending");

  await expect(page.getByRole("tab", { name: /^将截止/ })).toHaveAttribute("aria-selected", "true");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card).toContainText("将截止");
  await expect(card).toContainText("还要招人就续期");
  await page.screenshot({ path: testInfo.outputPath("ending.png"), fullPage: true });

  await card.getByRole("button", { name: "续期", exact: true }).click();
  const question = card.getByRole("group", { name: "续期多久？" });
  await expect(question.getByRole("radio", { name: /^30 天/ })).toBeChecked();
  await question.getByRole("radio", { name: /^14 天/ }).check();
  await page.screenshot({ path: testInfo.outputPath("renew-question.png"), fullPage: true });
  await question.getByRole("button", { name: "确定续期" }).click();
  await expect(page.getByRole("status")).toHaveText(new RegExp(`^${title}：已续期 14 天，\\d+月\\d+日截止$`));
  // It is live again, so it leaves 将截止 for 招聘中; pushed back from the old date (2.5 days away), not from today.
  await expect(card).toHaveCount(0);
  await page.getByRole("tab", { name: /^招聘中/ }).click();
  await expect(card).toContainText("17 天后截止");
  await expect(card).toContainText("已续期 1 次");
});

test("a job closed more than 14 days ago is published again as a new job; the old one stays closed", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("重新发布测试", testInfo);
  const jobId = (await publishJob(page, title))!;
  await setJobClosing(page, jobId, -20);

  await page.goto("/employer/jobs?tab=timed_out");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card).toContainText("已截止");
  await expect(card).toContainText("已不能续期");
  await (await cardMenuItem(card, "重新发布")).click();

  await expect(page).toHaveURL(`/employer/jobs/${jobId}/republish`);
  await expect(page.getByRole("heading", { name: "重新发布" })).toBeVisible();
  await expect(page.getByLabel("职位名称（中文）")).toHaveValue(title);
  const again = uniqueTitle("重新发布新职位", testInfo);
  await page.getByLabel("职位名称（中文）").fill(again);
  await page.screenshot({ path: testInfo.outputPath("republish.png"), fullPage: true });
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已发布" })).toBeVisible();

  await page.goto("/employer/jobs");
  await expect(card).toContainText("已截止");
  const fresh = page.getByRole("article").filter({ has: page.getByRole("heading", { name: again }) });
  await expect(fresh).toContainText("招聘中");
  await expect(fresh).toContainText("30 天后截止");
});
