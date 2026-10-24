// 发送我的简历 (#379, ADR 0037): a job seeker sends their 中英文简历 into a chat; the business gets a card that opens
// the page as it was when sent, with the contact details the job seeker ticked. Only the two sides open it.
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { exchangeTool, expectProfileSaved, freshEmail, signIn } from "./helpers";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

async function secondBrowser(browser: Browser, testInfo: TestInfo): Promise<Page> {
  return (await browser.newContext({ ...testInfo.project.use })).newPage();
}

const log = (page: Page) => page.getByRole("log", { name: "消息记录" });
const sheet = (page: Page) => page.getByRole("article", { name: "中英文简历" }).filter({ visible: true });

test("the business gets the résumé as sent, with the contact details ticked; a stranger gets nothing", async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  await signUpEmployer(page, testInfo);
  const jobId = await publishJob(page, uniqueTitle("简历卡片服务员", testInfo));

  // 林晓's demo page (#125), with a phone and an email; only the phone ticked for the résumé.
  const seeker = await secondBrowser(browser, testInfo);
  await signIn(seeker, "/profile", freshEmail("demo.chat.resume"));
  await seeker.getByLabel("交换用电话").fill("09 055 0379");
  await seeker.getByLabel("交换用邮箱").fill("lin.card@example.com");
  await expectProfileSaved(seeker);
  await seeker.goto("/profile/resume");
  await seeker.getByRole("checkbox", { name: /电话/ }).check();
  await expect(sheet(seeker)).toContainText("09 055 0379");

  await seeker.goto(`/jobs/${jobId}`);
  await seeker.getByRole("main").getByRole("button", { name: "立即沟通", exact: true }).click();
  await expect(seeker).toHaveURL(/\/messages\?conversation=employer%3A/);
  await (await exchangeTool(seeker, "发送我的简历")).click();
  const dialog = seeker.getByRole("dialog", { name: "发送我的简历" });
  await expect(dialog).toContainText("这份简历会带上：电话");
  await expect(dialog.getByRole("link", { name: "去改" })).toHaveAttribute("href", "/profile/resume#resume-contact");
  await dialog.getByRole("button", { name: "发送简历", exact: true }).click();
  const mine = log(seeker).getByRole("group", { name: "林晓的中英文简历" });
  await expect(mine).toContainText("带联系方式：电话");
  await expect(mine.getByRole("link", { name: "查看简历" })).toBeVisible();

  // The business: the card in its chat list and log, the page behind it.
  await page.goto("/messages");
  const row = page
    .getByRole("complementary", { name: "聊天列表" })
    .getByRole("button")
    .filter({ hasText: "[简历] 林晓" });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.click();
  const card = log(page).getByRole("group", { name: "林晓的中英文简历" });
  await expect(card).toContainText("带联系方式：电话");
  await card.getByRole("link", { name: "查看简历" }).click();
  await expect(page).toHaveURL(/\/messages\/resume\/\d+$/);
  await expect(sheet(page)).toContainText("林晓");
  await expect(sheet(page)).toContainText("09 055 0379");
  await expect(sheet(page)).not.toContainText("lin.card@example.com");
  const path = new URL(page.url()).pathname;

  // A change to the résumé afterwards does not change the one sent.
  await seeker.goto("/profile/resume");
  await seeker.getByRole("checkbox", { name: /电话/ }).uncheck();
  await seeker.getByRole("checkbox", { name: /邮箱/ }).check();
  await page.reload();
  await expect(sheet(page)).toContainText("09 055 0379");

  // Someone else, signed in, sees the 404 card.
  const stranger = await secondBrowser(browser, testInfo);
  await signIn(stranger, path, freshEmail("e2e.chat.resume.stranger"));
  await expect(stranger.getByRole("heading", { name: "看不到这份简历" })).toBeVisible();
  await expect(stranger.getByText("09 055 0379")).toHaveCount(0);
  await stranger.context().close();
  await seeker.context().close();
});

test("without a résumé yet, 发送我的简历 points to making one and sends nothing", async ({
  page,
  browser,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const jobId = await publishJob(page, uniqueTitle("没简历服务员", testInfo));
  const seeker = await secondBrowser(browser, testInfo);
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.chat.resume.none"));
  await seeker.getByRole("main").getByRole("button", { name: "立即沟通", exact: true }).click();
  await expect(seeker).toHaveURL(/\/messages\?conversation=employer%3A/);
  await (await exchangeTool(seeker, "发送我的简历")).click();
  const dialog = seeker.getByRole("dialog", { name: "发送我的简历" });
  await expect(dialog).toContainText("你还没有可以发的简历");
  await expect(dialog.getByRole("link", { name: "去生成简历" })).toHaveAttribute("href", "/profile/resume");
  await expect(dialog.getByRole("button", { name: "发送简历", exact: true })).toBeDisabled();
  await seeker.context().close();
});
