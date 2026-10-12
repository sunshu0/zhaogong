import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CLEAN_MESSAGE, publishJob, signInAs, uniqueTitle, openTheForm } from "./helpers";

// axe on every employer and moderation page, in the states people actually see, at 375 px and
// 1280 px (the two projects). WCAG 2.1 A and AA, no exceptions.
async function expectNoViolations(page: Page, state: string) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const found = violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `    ${n.target.join(" ")} — ${n.failureSummary?.split("\n").join(" ")}`).join("\n")}`);
  expect.soft(found, `${state}\n${found.join("\n")}`).toEqual([]);
}

test("post flow, every step", async ({ page }, testInfo) => {
  await page.goto("/employer/post");
  await expectNoViolations(page, "post: chat, greeting");
  await page.getByLabel("回复助手").fill("奶茶店招兼职店员，市中心，时薪 18，入职交押金200。学签OK。微信 cbdtea_demo");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(page.getByRole("button", { name: "删掉这句" }).or(page.getByText("时薪改成多少").filter({ visible: true })).first()).toBeVisible();
  await expectNoViolations(page, "post: chat, a compliance question");

  // After chatting, 直接填表 opens the form with the chat's draft; start over for the paste step.
  await page.goto("/employer/post");
  await openTheForm(page);
  await expectNoViolations(page, "post: paste step");

  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill("奶茶店招兼职店员，市中心，时薪 20，入职交押金200，限华人。学签OK。微信 cbdtea_demo");
  await page.getByRole("button", { name: "整理成职位" }).click();
  await expect(page.getByLabel("职位名称（中文）")).toHaveValue("店员");
  await expectNoViolations(page, "post: form with findings");

  await page.goto("/employer/post");
  await openTheForm(page);
  await page.getByRole("button", { name: "不用粘贴，直接填表" }).click();
  await expectNoViolations(page, "post: empty form, everything missing");

  await page.getByRole("button", { name: "上一步" }).click();
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await page.getByRole("button", { name: "整理成职位" }).click();
  // Never publish under a demo job's title: line A's specs tell demo jobs apart by title.
  await page.getByLabel("职位名称（中文）").fill(uniqueTitle("前厅服务员", testInfo));
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.getByText("这是求职者看到的样子").filter({ visible: true })).toBeVisible();
  await expectNoViolations(page, "post: preview, signed out");

  await signInAs(page);
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已发布" })).toBeVisible();
  await expectNoViolations(page, "post: published, share texts");
});

test("employer home, manage jobs and verification", async ({ page }, testInfo) => {
  await page.goto("/employer");
  await expectNoViolations(page, "/employer signed out");

  await publishJob(page, uniqueTitle("前厅服务员", testInfo));
  await page.goto("/employer");
  await expect(page.getByText("管理全部").filter({ visible: true })).toBeVisible();
  await expectNoViolations(page, "/employer signed in");

  await page.goto("/employer/jobs");
  const card = page.getByRole("article").first();
  await card.getByRole("button", { name: "结束招聘" }).click();
  await card.getByRole("button", { name: "复制文案" }).click();
  await expectNoViolations(page, "/employer/jobs with confirm and share open");

  await page.goto("/employer/verify");
  await page.getByLabel("公司名称或 NZBN").fill("demo");
  await page.getByRole("button", { name: "查询" }).click();
  await expect(page.getByText("NZBN 9429000000001").filter({ visible: true })).toBeVisible();
  await expectNoViolations(page, "/employer/verify with results");
});

test("moderation queue, each tab", async ({ page }, testInfo) => {
  const title = uniqueTitle("前厅服务员", testInfo);
  const id = await publishJob(page, title);
  await publishJob(page, uniqueTitle("前厅服务员", testInfo), CLEAN_MESSAGE.replace("Mt Eden 川菜馆", "Mt Eden KTV 楼下川菜馆"));
  await page.goto(`/jobs/${id}`);
  await page.getByRole("button", { name: "举报这个职位" }).click();
  await page.getByRole("group", { name: "举报这个职位" }).getByLabel("虚假职位").check();
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");

  await page.goto("/admin");
  await expect(page.getByRole("article").first()).toBeVisible();
  await expectNoViolations(page, "/admin flagged");
  await page.getByRole("tab", { name: /被举报/ }).click();
  await page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) }).getByRole("button", { name: "下架" }).click();
  await expect(page.getByRole("status")).toContainText("已处理");
  await expectNoViolations(page, "/admin after an action");
  await page.getByRole("tab", { name: /操作记录/ }).click();
  await expectNoViolations(page, "/admin log");
});
