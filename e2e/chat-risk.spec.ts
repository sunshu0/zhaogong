// 聊天风险 (#384, ADR 0039): a message that hits the chat rules goes as written; the sender sees a line under it that
// the other side is warned, the other side the reminder. A business that does it three times within a week shows in
// /admin 聊天风险; the messages open behind a button, the opening is in 查看记录, and 看过，关闭 takes it off.
import { expect, test, type Page } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";
import { moderatorPage, publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

const log = (page: Page) => page.getByRole("log", { name: "消息记录" });

async function send(page: Page, text: string) {
  await page.getByLabel("输入消息").fill(text);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(log(page)).toContainText(text);
}

test("both sides are told, only the business's messages count, and a moderator looks at them", async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  const shop = await signUpEmployer(page, testInfo);
  const jobId = await publishJob(page, uniqueTitle("风险提示服务员", testInfo));
  const run = `${testInfo.project.name}${Date.now() % 100_000}`;

  // The job seeker asks about a deposit: their own line says the other side sees a reminder; it is not counted.
  const seeker = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.chat.risk"));
  await seeker.getByRole("main").getByRole("button", { name: "立即沟通", exact: true }).click();
  await expect(seeker).toHaveURL(/\/messages\?conversation=employer%3A/);
  await send(seeker, `要先交押金吗 ${run}`);
  const mine = log(seeker).getByRole("note", { name: "我发出的消息的合规提醒" });
  await expect(mine).toHaveText("这条消息提到「押金」：找工不允许向求职者收取押金或任何费用。对方会看到一条提醒。");

  // The business answers three times with what the rules stop.
  await page.goto("/messages");
  const row = page.getByRole("complementary", { name: "聊天列表" }).getByRole("button").filter({ hasText: run });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();
  await expect(log(page).getByRole("note", { name: "合规提醒", exact: true })).toHaveCount(1); // under the job seeker's question
  const words = [`入职前先交押金 200 ${run}`, `押金可以分两次交 ${run}`, `不想交押金的话可以在家刷单 ${run}`];
  for (const text of words) await send(page, text);
  await expect(log(page).getByRole("note", { name: "我发出的消息的合规提醒" })).toHaveCount(3);

  // The job seeker sees each with a reminder and a report button.
  await seeker.reload();
  await expect(log(seeker)).toContainText(words[2], { timeout: 20_000 });
  const reminders = log(seeker).getByRole("note", { name: "合规提醒", exact: true });
  await expect(reminders).toHaveCount(3);
  await expect(reminders.last()).toContainText("这类往往是诈骗：不要先垫钱；可以举报。");
  await expect(reminders.last().getByRole("button", { name: "举报这条消息" })).toBeVisible();
  await seeker.context().close();

  // The moderator: the business, the kinds and the count, without the words until opened.
  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: /^聊天风险/ }).click();
  const card = admin.getByRole("article", { name: `${shop}的聊天风险` });
  await expect(card).toContainText("收费用词");
  await expect(card).toContainText("刷单用词");
  await expect(card).toContainText("3 条消息");
  await expect(admin.getByRole("tabpanel")).not.toContainText(run);
  await card.getByRole("button", { name: "查看这 3 条消息" }).click();
  const messages = card.getByRole("list", { name: "触发规则的聊天消息" });
  for (const text of words) await expect(messages).toContainText(text);
  await expect(messages).not.toContainText(`要先交押金吗 ${run}`);

  await card.getByRole("button", { name: "看过，关闭" }).click();
  await expect(admin.getByRole("status")).toContainText(`看过并关闭「${shop}」的聊天风险`);
  await expect(card).toHaveCount(0);

  await admin.getByRole("tab", { name: /^查看记录/ }).click();
  const views = admin.getByRole("region", { name: "审核员看过谁的个人信息" });
  await expect(views.getByRole("row").nth(1)).toContainText("聊天");
  await admin.context().close();
});
