import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { chatAboutJob, expectChatUnread, signIn } from "../helpers";
import { waitForTitle } from "../helpers/title";
import { moderatorPage, openAdminTab, openReportForm, publishJob, signUpEmployer, uniqueTitle } from "./helpers";

// 审核员和雇主聊天 (#407, ADR 0046): a moderator opens a conversation with a business from a report; everyone in the
// business's team reads and answers it in 消息, where the moderators are 找工审核员; the moderators see who wrote, and
// a business under a ban can still answer.

test.use({ reducedMotion: "reduce" });

async function expectNoViolations(page: Page, state: string) {
  await waitForTitle(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const found = violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target).join(", ")}`);
  expect.soft(found, `${state}\n${found.join("\n")}`).toEqual([]);
}

async function newPage(browser: Browser, testInfo: TestInfo): Promise<Page> {
  return (await browser.newContext({ ...testInfo.project.use })).newPage();
}

/** Writes in whichever conversation is open and waits for it in the messages. */
async function write(page: Page, text: string) {
  await page.getByLabel("输入消息").fill(text);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByRole("log", { name: "消息记录" })).toContainText(text);
  await expect(page.getByLabel("输入消息")).toHaveValue("");
}

/** The business's side: 消息 with the moderators' conversation pinned, opened. */
async function openModerators(page: Page) {
  await page.goto("/messages");
  await page.getByRole("button", { name: /找工审核员/ }).click();
  return page.getByRole("region", { name: "和找工审核员的对话" });
}

/** 审核后台's groups: 待处理, 记录与统计, 聊天. */
const groups = (admin: Page) => admin.getByRole("tablist", { name: "审核后台分组" });

/** The moderators' side: the 聊天 group, then the business's conversation in its list. */
async function openChat(admin: Page, shop: string) {
  await groups(admin).getByRole("tab", { name: /^聊天/ }).click();
  await admin
    .getByRole("complementary", { name: "和企业的对话" })
    .getByRole("button", { name: new RegExp(shop) })
    .click();
}

test("a moderator asks a business from a report, its whole team answers, and a banned business still can", async ({
  browser,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  // A business with a teammate, 小李, who joins through a link.
  const shop = await signUpEmployer(page, testInfo, "/employer/team");
  await page.getByRole("button", { name: "生成邀请链接" }).click();
  const link = new URL(await page.getByRole("textbox", { name: "邀请链接" }).inputValue()).pathname;
  const mate = await newPage(browser, testInfo);
  await signIn(mate, "/account");
  await mate.goto(link);
  await mate.getByLabel(/你在团队里的称呼/).fill("小李");
  await mate.getByRole("button", { name: "加入团队" }).click();
  await expect(mate).toHaveURL("/employer/team");

  // Its job, reported by a job seeker.
  const title = uniqueTitle("前厅服务员", testInfo);
  const jobId = (await publishJob(page, title))!;
  const seeker = await newPage(browser, testInfo);
  await signIn(seeker, "/");
  await chatAboutJob(seeker, jobId);
  await seeker.goto(`/jobs/${jobId}`);
  await openReportForm(seeker);
  await seeker.getByRole("group", { name: "举报这个职位" }).getByLabel("收押金 / 介绍费").check();
  await seeker.getByRole("button", { name: "提交举报" }).click();
  await expect(seeker.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");
  await seeker.context().close();

  // The moderator opens a conversation from the report, and asks.
  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await openAdminTab(admin, /被举报/);
  const card = admin.getByRole("article").filter({ has: admin.getByRole("heading", { name: title }) });
  await card.getByRole("button", { name: "和企业聊天" }).click();
  const thread = admin.getByRole("region", { name: `和「${shop}」的对话` });
  await expect(thread).toBeVisible();
  await expect(groups(admin).getByRole("tab", { name: /^聊天/, selected: true })).toBeVisible();
  await write(admin, "有人举报你们收押金，请说明一下。");
  await expect(thread.getByText("你", { exact: true })).toBeVisible();
  await expectNoViolations(admin, "/admin 聊天");

  // The business: unread in 聊天 (the job seeker's message and the moderators'), pinned in 消息 as 找工审核员, with no
  // moderator's email anywhere.
  await page.goto("/messages");
  await expectChatUnread(page, "聊天，2 条未读消息");
  const theirs = await openModerators(page);
  await expect(theirs).toContainText("有人举报你们收押金，请说明一下。");
  await expect(page.getByText("moderator@example.com")).toHaveCount(0);
  // Only words: no job strip, exchanges, 常用语 or 举报.
  await expect(theirs.getByRole("button", { name: /更多|交换|举报/ })).toHaveCount(0);
  await write(page, "我们没有收押金。");
  await expectNoViolations(page, "/messages 找工审核员");

  // The teammate sees all of it and answers too.
  const mates = await openModerators(mate);
  await expect(mates).toContainText("我们没有收押金。");
  await write(mate, "我是店里的小李，可以补材料。");

  // The moderators: what waits on the group, and in the conversation who in the team wrote.
  await admin.goto("/admin");
  await expect(groups(admin).getByRole("tab", { name: /^聊天 2$/ })).toBeVisible();
  await openChat(admin, shop);
  await expect(thread).toContainText("我们没有收押金。");
  await expect(thread.getByText(`${shop} · 小李`)).toBeVisible();
  await expect(groups(admin).getByRole("tab", { name: /^聊天\s*$/ })).toBeVisible(); // read now

  // A temporary ban: the business still reads and answers (its people are job seekers here meanwhile).
  await admin.goto("/admin");
  await openAdminTab(admin, /被举报/);
  await card.getByRole("button", { name: "封禁雇主" }).click();
  const choice = card.getByRole("group", { name: `封禁「${shop}」` });
  await choice.getByLabel("暂时封禁 3 天").check();
  await choice.getByLabel(/^原因（雇主的团队会看到/).fill("要求求职者交押金");
  await choice.getByRole("button", { name: /^确定暂时封禁/ }).click();
  await expect(admin.getByRole("status")).toContainText("已处理：暂时封禁雇主");

  const banned = await openModerators(page);
  await expect(banned).toContainText("有人举报你们收押金，请说明一下。");
  await write(page, "我想申诉，我们会改。");
  await admin.goto("/admin");
  await openChat(admin, shop);
  await expect(thread).toContainText("我想申诉，我们会改。");

  await admin.context().close();
  await mate.context().close();
});
