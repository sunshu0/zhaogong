// 双方聊天 (#110, ADR 0015): a job seeker and a business, each in their own browser, talk in one conversation that
// lives on the server. Nothing is scripted: what one sends, the other reads, within the chat page's 10 seconds.
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { chatAboutJob, freshEmail, signIn } from "./helpers";
import { candidateCard, publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

async function secondBrowser(browser: Browser, testInfo: TestInfo): Promise<Page> {
  return (await browser.newContext({ ...testInfo.project.use })).newPage();
}

const log = (page: Page) => page.getByRole("log", { name: "消息记录" });
const chatList = (page: Page) => page.getByRole("complementary", { name: "聊天列表" });

test("a job seeker writes from the job page, the business answers, each sees the other's message", async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  const shop = await signUpEmployer(page, testInfo);
  const title = uniqueTitle("双方聊天服务员", testInfo);
  const jobId = await publishJob(page, title);

  const seeker = await secondBrowser(browser, testInfo);
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.two.way"));
  await seeker.getByRole("button", { name: "立即沟通" }).click();
  await expect(seeker).toHaveURL(/\/messages\?conversation=employer%3A/);
  // Under the chat on desktop; the first line of the full-screen conversation's messages on a phone (T1, ADR 0042).
  await expect(seeker.getByText("消息保存在服务器上，双方都能看到").filter({ visible: true })).toBeVisible();
  await seeker.getByLabel("输入消息").fill("你好，这个职位还招人吗？");
  await seeker.getByRole("button", { name: "发送", exact: true }).click();
  await expect(log(seeker)).toContainText("你好，这个职位还招人吗？");

  // The business (王经理 in its team, #87) finds it in 招聘聊天, from a job seeker without a page yet.
  await page.goto("/employer/team");
  await page.getByLabel(/^称呼/).fill("王经理");
  await page.getByRole("button", { name: "保存称呼" }).click();
  await expect(page.getByRole("status")).toHaveText("称呼已保存。");
  await page.goto("/messages");
  const row = chatList(page).getByRole("button", { name: /求职者/ });
  await expect(row).toContainText("你好，这个职位还招人吗？");
  await row.click();
  await expect(page.getByRole("link", { name: /^聊的职位：/ })).toHaveAttribute("href", `/jobs/${jobId}`);
  await expect(log(page)).toContainText("你好，这个职位还招人吗？");
  await page.getByLabel("输入消息").fill("还招，明天下午来店里聊聊吧");
  await page.getByRole("button", { name: "发送", exact: true }).click();

  // The job seeker's page reads again within 10 seconds: the answer, signed 「店名 · 王经理」, and their own message
  // read.
  const answer = log(seeker)
    .locator("div", { hasText: /^还招，明天下午来店里聊聊吧/ })
    .last();
  await expect(answer).toBeVisible({ timeout: 20_000 });
  await expect(answer.locator("[data-message-by]")).toHaveText(`${shop} · 王经理`);
  await expect(log(seeker).locator("[data-message-read]").first()).toHaveText("对方已读");

  // And the business sees the reply to its answer the same way.
  await seeker.getByLabel("输入消息").fill("好的，明天见");
  await seeker.getByRole("button", { name: "发送", exact: true }).click();
  await expect(log(page)).toContainText("好的，明天见", { timeout: 20_000 });
  await seeker.context().close();
});

test("the business's 打开聊天 on someone who chatted is the same conversation, both ways (ADR 0030)", async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("聊过的人聊天", testInfo);
  const jobId = await publishJob(page, title);

  const seeker = await secondBrowser(browser, testInfo);
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.two.way.chatted"));
  await chatAboutJob(seeker, jobId!, "还招人吗？");

  await (await candidateCard(page, jobId!)).getByRole("button", { name: "打开聊天" }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=chat%3A/);
  await expect(log(page)).toContainText("还招人吗？");
  await page.getByLabel("输入消息").fill("还招，周末能上班吗？");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(log(page)).toContainText("周末能上班吗");

  await seeker.goto("/messages");
  await chatList(seeker).getByRole("button").filter({ hasText: "周末能上班吗" }).click();
  await expect(log(seeker)).toContainText("还招，周末能上班吗？");
  await seeker.context().close();
});
