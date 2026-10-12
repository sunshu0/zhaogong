import { expect, test } from "@playwright/test";
import { CLEAN_MESSAGE, jobCard, publishJob, searchJobList, signUpEmployer, uniqueTitle } from "./helpers";

test("report a job → /admin takes it down → gone from the list and in the log", async ({ page }, testInfo) => {
  const shop = await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);
  const id = await publishJob(page, title);

  // A job seeker reports it.
  await page.goto(`/jobs/${id}`);
  await page.getByRole("button", { name: "举报这个职位" }).click();
  await page.getByRole("group", { name: "举报这个职位" }).getByLabel("收押金 / 介绍费").check();
  await page.getByLabel("补充说明（选填）").fill(`打电话说要先交押金（${title}）`);
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");

  await page.goto("/admin");
  await expect(page.getByRole("note")).toContainText("演示后台");
  await page.getByRole("tab", { name: /被举报/ }).click();
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card).toContainText("1 条举报");
  await expect(card).toContainText(`收押金 / 介绍费：打电话说要先交押金（${title}）`);

  await card.getByRole("button", { name: "下架" }).click();
  const done = `下架「${title}」（${shop}） · 举报：收押金 / 介绍费`;
  await expect(page.getByRole("status")).toHaveText(`已处理：${done}`);
  await expect(card).toHaveCount(0);

  await page.getByRole("tab", { name: /操作记录/ }).click();
  await expect(page.getByRole("listitem").filter({ hasText: done })).toBeVisible();

  await searchJobList(page, title);
  await expect(page.getByText("暂时没有符合条件的职位").filter({ visible: true })).toBeVisible();
});

test("a job flagged at posting waits for review, then /admin approves it onto the list", async ({ page }, testInfo) => {
  const shop = await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);
  await publishJob(page, title, CLEAN_MESSAGE.replace("Mt Eden 川菜馆", "Mt Eden KTV 楼下川菜馆"));

  await searchJobList(page, title);
  await expect(page.getByText("暂时没有符合条件的职位").filter({ visible: true })).toBeVisible();

  await page.goto("/admin");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card).toContainText("需审核：含有「KTV」");
  await card.getByRole("button", { name: "没问题，通过" }).click();
  await expect(page.getByRole("status")).toHaveText(`已处理：审核通过「${title}」（${shop}） · 标记：高风险行业`);

  await searchJobList(page, title);
  await expect(jobCard(page, title)).toBeVisible();
});
