import { expect, test } from "@playwright/test";
import { signIn } from "../helpers";
import {
  CLEAN_MESSAGE,
  jobCard,
  moderatorPage,
  MODERATOR_EMAIL,
  publishJob,
  searchJobList,
  signUpEmployer,
  uniqueTitle,
  openReportForm,
} from "./helpers";

test("report a job → /admin takes it down → gone from the list and in the log", async ({ browser, page }, testInfo) => {
  const shop = await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);
  const id = await publishJob(page, title);

  // A job seeker reports it.
  await page.goto(`/jobs/${id}`);
  await openReportForm(page);
  await page.getByRole("group", { name: "举报这个职位" }).getByLabel("收押金 / 介绍费").check();
  await page.getByLabel("补充说明（选填）").fill(`打电话说要先交押金（${title}）`);
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");

  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await expect(admin.getByRole("note")).toContainText("只有审核员能使用审核后台");
  await admin.getByRole("tab", { name: /被举报/ }).click();
  await expect(admin.getByText("这里只收录对职位的举报，聊天里的举报不在这里。")).toBeVisible();
  const card = admin.getByRole("article").filter({ has: admin.getByRole("heading", { name: title }) });
  await expect(card).toContainText("1 条举报");
  await expect(card).toContainText(`收押金 / 介绍费：打电话说要先交押金（${title}）`);

  await card.getByRole("button", { name: "下架" }).click();
  const done = `下架「${title}」（${shop}） · 举报：收押金 / 介绍费`;
  await expect(admin.getByRole("status")).toHaveText(`已处理：${done}`);
  await expect(card).toHaveCount(0);

  await admin.getByRole("tab", { name: /操作记录/ }).click();
  const entry = admin.getByRole("listitem").filter({ hasText: done });
  await expect(entry).toBeVisible();
  await expect(entry).toContainText(`操作人：${MODERATOR_EMAIL}`); // #60
  await admin.context().close();

  await searchJobList(page, title);
  await expect(page.getByText("暂时没有符合条件的职位").filter({ visible: true })).toBeVisible();
});

test("a job flagged at posting waits for review, then /admin approves it onto the list", async ({
  browser,
  page,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);
  await publishJob(page, title, CLEAN_MESSAGE.replace("Mt Eden 川菜馆", "Mt Eden KTV 楼下川菜馆"));

  await searchJobList(page, title);
  await expect(page.getByText("暂时没有符合条件的职位").filter({ visible: true })).toBeVisible();

  // The employer is not a moderator: /admin refuses.
  await page.goto("/admin");
  await expect(page.getByText("只有审核员能使用审核后台。", { exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);

  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  const card = admin.getByRole("article").filter({ has: admin.getByRole("heading", { name: title }) });
  await expect(card).toContainText("需审核：含有「KTV」");
  await card.getByRole("button", { name: "没问题，通过" }).click();
  await expect(admin.getByRole("status")).toHaveText(`已处理：审核通过「${title}」（${shop}） · 标记：高风险行业`);
  await admin.context().close();

  await searchJobList(page, title);
  await expect(jobCard(page, title)).toBeVisible();
});

test("a moderator adds another account as a moderator, then removes it (#50)", async ({ browser, page }, testInfo) => {
  // Someone signs in; /admin is not for them yet.
  const email = await signIn(page, "/admin");
  await expect(page.getByText("只有审核员能使用审核后台。", { exact: true })).toBeVisible();

  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: "审核员" }).click();
  await expect(admin.getByText(`${MODERATOR_EMAIL}（你）`)).toBeVisible();
  await admin.getByLabel("邮箱").fill(email);
  await admin.getByRole("button", { name: "添加", exact: true }).click();
  await expect(admin.getByRole("status")).toHaveText(`已处理：添加审核员 ${email}`);
  await expect(admin.getByText(`由${MODERATOR_EMAIL}添加`).first()).toBeVisible();

  // Now they are a moderator.
  await page.reload();
  await expect(page.getByRole("tab", { name: /发布时被标记/ })).toBeVisible();

  await admin.getByRole("button", { name: `移除审核员 ${email}` }).click();
  await expect(admin.getByRole("status")).toHaveText(`已处理：移除审核员 ${email}`);
  await expect(admin.getByRole("button", { name: `移除审核员 ${email}` })).toHaveCount(0);
  await admin.context().close();

  await page.reload();
  await expect(page.getByText("只有审核员能使用审核后台。", { exact: true })).toBeVisible();
});
