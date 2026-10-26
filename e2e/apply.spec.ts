// 申请 is gone from the job pages (user 10-20 11:0x): chatting is how a job seeker gets in touch, and the business's
// list is 聊过这个职位的人 (ADR 0030). Marks are made on the list or in the chat; the job seeker reads how it went in
// 我的申请, read only.
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { chatAboutJob, freshEmail, signIn } from "./helpers";
import { candidateCard, publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

async function seekerPage(browser: Browser, testInfo: TestInfo): Promise<Page> {
  return (await browser.newContext({ ...testInfo.project.use })).newPage();
}

test("no 申请 on the job page or the job rows; who chatted is on the business's list and in 我的申请", async ({
  page,
  browser,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("聊过服务员", testInfo);
  const jobId = (await publishJob(page, title))!;

  const seeker = await seekerPage(browser, testInfo);
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.chatted"));
  await expect(seeker.getByRole("main").getByRole("button", { name: "立即沟通", exact: true })).toBeVisible();
  await expect(seeker.getByRole("button", { name: /^申请/ })).toHaveCount(0);
  await seeker.goto("/jobs");
  await expect(seeker.getByRole("main").getByRole("article").first()).toBeVisible();
  await expect(seeker.getByRole("button", { name: /^申请：/ })).toHaveCount(0);

  await chatAboutJob(seeker, jobId, "周末都能上班");
  const candidate = await candidateCard(page, jobId);
  await expect(page.getByRole("heading", { name: "聊过这个职位的人", level: 1 })).toBeVisible();
  await expect(candidate).toContainText("开始聊");
  await expect(candidate).toContainText("没有发主页，资料在聊天里问");
  await candidate.getByRole("button", { name: "合适", exact: true }).click();
  await expect(candidate.getByRole("button", { name: "合适", exact: true })).toHaveAttribute("aria-pressed", "true");

  await seeker.goto("/me/saved");
  const mine = seeker.getByRole("region", { name: /^我的申请/ }).getByRole("article", { name: title });
  await expect(mine).toContainText("雇主觉得合适");
  await expect(mine).toContainText("开始聊");
  await expect(mine.getByRole("button")).toHaveCount(0); // nothing to withdraw
  // #354: it says how to reach an employer now.
  await expect(seeker.getByRole("region", { name: /^我的申请/ })).toContainText("请在职位页点「立即沟通」");
  await seeker.context().close();
});

test("the business marks 已录用 in the chat, and the job seeker is told", async ({ page, browser }, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("聊天录用", testInfo);
  const jobId = (await publishJob(page, title))!;

  const seeker = await seekerPage(browser, testInfo);
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.chat.hired"));
  await chatAboutJob(seeker, jobId);

  await (await candidateCard(page, jobId)).getByRole("button", { name: "打开聊天" }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=chat%3A/);
  const marks = page.getByRole("group", { name: "标记这位求职者" });
  const hired = marks.getByRole("button", { name: "已录用", exact: true });
  await expect(hired).toHaveAttribute("aria-pressed", "false");
  await hired.click();
  await expect(hired).toHaveAttribute("aria-pressed", "true");
  await expect(hired).not.toHaveAttribute("aria-busy");
  await page.getByRole("link", { name: "这个职位聊过的人" }).click();
  await expect(page).toHaveURL(`/employer/jobs/${jobId}/applicants`);
  await expect(page.getByRole("article", { name: "候选人 求职者" })).toContainText("已录用");

  await seeker.goto("/me/saved");
  const mine = seeker.getByRole("region", { name: /^我的申请/ }).getByRole("article", { name: title });
  await expect(mine).toContainText("已录用");
  await seeker.context().close();
});
