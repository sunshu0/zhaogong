import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { chatAboutJob, signIn } from "../helpers";
import { waitForTitle } from "../helpers/title";
import {
  jobCard,
  moderatorPage,
  MODERATOR_EMAIL,
  openAdminTab,
  openReportForm,
  publishJob,
  searchJobList,
  signUpEmployer,
  uniqueTitle,
} from "./helpers";

// 暂时封禁 (#401, ADR 0044): a moderator bans a business for some days with a reason. Its jobs are hidden but not
// taken down, its team sees until when and why, and no message goes either way; when the ban runs out, or a moderator
// lifts it early, everything is back.

// axe scans the settled page, as in a11y.spec.ts.
test.use({ reducedMotion: "reduce" });

async function expectNoViolations(page: Page, state: string) {
  await waitForTitle(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const found = violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target).join(", ")}`);
  expect.soft(found, `${state}\n${found.join("\n")}`).toEqual([]);
}

/**
 * An employer publishes a job; a job seeker (a second browser) chats about it and reports it. Returns the job, the
 * business and the conversation's address.
 */
async function reportedJob(browser: Browser, page: Page, testInfo: TestInfo) {
  const shop = await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);
  const jobId = (await publishJob(page, title))!;

  const seeker = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await signIn(seeker, "/");
  await chatAboutJob(seeker, jobId);
  const conversation = seeker.url();
  await seeker.goto(`/jobs/${jobId}`);
  const employerId = (await seeker.getByRole("main").locator('a[href^="/employers/"]').first().getAttribute("href"))!
    .split("/")
    .pop()!;
  await openReportForm(seeker);
  await seeker.getByRole("group", { name: "举报这个职位" }).getByLabel("收押金 / 介绍费").check();
  await seeker.getByRole("button", { name: "提交举报" }).click();
  await expect(seeker.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");
  return { shop, title, jobId, employerId, seeker, conversation };
}

/** The moderator bans the business behind the reported job for `days` days. */
async function tempBan(admin: Page, title: string, shop: string, days: 3 | 7 | 30, reason: string) {
  await admin.goto("/admin");
  await openAdminTab(admin, /被举报/);
  const card = admin.getByRole("article").filter({ has: admin.getByRole("heading", { name: title }) });
  await card.getByRole("button", { name: "封禁雇主" }).click();
  const choice = card.getByRole("group", { name: `封禁「${shop}」` });
  const confirm = choice.getByRole("button", { name: /^确定/ });
  // Nothing is chosen at first, and a temporary ban needs a reason.
  await expect(confirm).toBeDisabled();
  await choice.getByLabel(`暂时封禁 ${days} 天`).check();
  await expect(confirm).toBeDisabled();
  await choice.getByLabel(/^原因（雇主的团队会看到/).fill(reason);
  await expect(confirm).toHaveText(`确定暂时封禁「${shop}」${days} 天`);
  await expectNoViolations(admin, "/admin ban choice");
  await confirm.click();
  await expect(admin.getByRole("status")).toHaveText(`已处理：暂时封禁雇主「${shop}」${days} 天 · ${reason}`);
}

/** Whether the job seeker can find and open the job. */
async function expectJobShown(seeker: Page, title: string, jobId: string, shown: boolean) {
  await searchJobList(seeker, title);
  if (shown) await expect(jobCard(seeker, title)).toBeVisible();
  else await expect(seeker.getByText("暂时没有符合条件的职位").filter({ visible: true })).toBeVisible();
  await seeker.goto(`/jobs/${jobId}`);
  const chat = seeker.getByRole("main").getByRole("button", { name: "立即沟通", exact: true });
  if (shown) await expect(chat).toBeVisible();
  else {
    await expect(seeker.getByRole("heading", { name: "职位不存在" })).toBeVisible();
    await expect(chat).toHaveCount(0);
  }
}

async function send(seeker: Page, conversation: string, text: string) {
  await seeker.goto(conversation);
  await seeker.getByLabel("输入消息").fill(text);
  await seeker.getByRole("button", { name: "发送", exact: true }).click();
}

test("a temporary ban hides the jobs, stops the chat both ways, and ends by itself", async ({
  browser,
  page,
}, testInfo) => {
  const { shop, title, jobId, employerId, seeker, conversation } = await reportedJob(browser, page, testInfo);
  const admin = await moderatorPage(browser, testInfo);
  await tempBan(admin, title, shop, 7, "电话里要求交押金");

  // The moderator sees it under 记录与统计 · 暂时封禁.
  await openAdminTab(admin, "暂时封禁");
  const row = admin.getByRole("listitem").filter({ hasText: shop });
  await expect(row).toContainText("原因：电话里要求交押金");
  await expect(row).toContainText(`封禁的人：${MODERATOR_EMAIL}`);
  await expectNoViolations(admin, "/admin temporary bans");

  // The business's team: until when and why, instead of its tools.
  await page.goto("/employer/jobs");
  await expect(page.getByText(/^你的企业被暂时限制到 .+，原因：电话里要求交押金。/)).toBeVisible();
  await expectNoViolations(page, "/employer/jobs under a temporary ban");

  // The job seeker: the job is gone while it lasts, and nothing reaches the business.
  await expectJobShown(seeker, title, jobId, false);
  // The conversation says so up front, with nothing to write in (the server refuses a send as well).
  await seeker.goto(conversation);
  await expect(seeker.getByRole("status").filter({ hasText: "对方暂时不能回复，现在发不了消息。" })).toBeVisible();
  await expect(seeker.getByLabel("输入消息")).toHaveCount(0);

  // The ban runs out (moved to a minute ago): the job is back without anyone doing anything, and the chat works.
  const response = await admin.request.post("/api/dev/ban-ending", { data: { employerId, minutesFromNow: -1 } });
  expect(response.status()).toBe(200);
  await expectJobShown(seeker, title, jobId, true);
  await send(seeker, conversation, "到期了，还招人吗？");
  await expect(seeker.getByRole("log", { name: "消息记录" })).toContainText("到期了，还招人吗？");
  await expect(seeker.getByText("对方暂时不能回复，现在发不了消息。")).toHaveCount(0);
  await page.goto("/employer/jobs");
  await expect(page.getByText(/你的企业被暂时限制到/)).toHaveCount(0);
  // The moderator coming back to the list (the open tab keeps what it loaded): the ban is no longer in it.
  await admin.goto("/admin");
  await openAdminTab(admin, "暂时封禁");
  await expect(admin.getByText("原因：电话里要求交押金")).toHaveCount(0);

  await admin.context().close();
  await seeker.context().close();
});

test("a moderator lifts a temporary ban early, and it is in the log", async ({ browser, page }, testInfo) => {
  const { shop, title, jobId, seeker } = await reportedJob(browser, page, testInfo);
  const admin = await moderatorPage(browser, testInfo);
  await tempBan(admin, title, shop, 3, "回复里态度恶劣");
  await expectJobShown(seeker, title, jobId, false);

  await openAdminTab(admin, "暂时封禁");
  await admin.getByRole("listitem").filter({ hasText: shop }).getByRole("button", { name: "提前解除" }).click();
  await expect(admin.getByRole("status")).toHaveText(`已处理：提前解除对雇主「${shop}」的暂时封禁`);
  await expect(admin.getByRole("listitem").filter({ hasText: shop })).toHaveCount(0);

  await expectJobShown(seeker, title, jobId, true);
  await page.goto("/employer/jobs");
  await expect(page.getByText(/你的企业被暂时限制到/)).toHaveCount(0);

  await openAdminTab(admin, /操作记录/);
  for (const done of [`提前解除对雇主「${shop}」的暂时封禁`, `暂时封禁雇主「${shop}」3 天 · 回复里态度恶劣`])
    await expect(admin.getByRole("listitem").filter({ hasText: done })).toContainText(`操作人：${MODERATOR_EMAIL}`);

  await admin.context().close();
  await seeker.context().close();
});
