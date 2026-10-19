// 申请 is gone from the job pages (user 10-20 11:0x): chatting is how a job seeker gets in touch. Applications made
// before stay: the job seeker reads them in 我的申请 (read only), and the business's 申请人 list still works until line
// B moves it to the job's chats. The application here is made through /api/dev/apply (applyForTest).
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { applyForTest, freshEmail, signIn } from "./helpers";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

async function seekerPage(browser: Browser, testInfo: TestInfo): Promise<Page> {
  return (await browser.newContext({ ...testInfo.project.use })).newPage();
}

test("no 申请 on the job page or the job rows; an application stays in 我的申请, read only", async ({
  page,
  browser,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("申请服务员", testInfo);
  const jobId = (await publishJob(page, title))!;

  const seeker = await seekerPage(browser, testInfo);
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("demo.apply")); // 林晓's demo page (#125)
  await expect(seeker.getByRole("main").getByRole("button", { name: "立即沟通", exact: true })).toBeVisible();
  await expect(seeker.getByRole("button", { name: /^申请/ })).toHaveCount(0);
  await seeker.goto("/jobs");
  await expect(seeker.getByRole("main").getByRole("article").first()).toBeVisible();
  await expect(seeker.getByRole("button", { name: /^申请：/ })).toHaveCount(0);

  await applyForTest(seeker, jobId, "周末都能上班");
  await page.goto(`/employer/jobs/${jobId}/applicants`);
  const applicant = page.getByRole("article", { name: "申请人 林晓" });
  await expect(applicant).toContainText("附言：周末都能上班");
  await applicant.getByRole("button", { name: "合适", exact: true }).click();
  await expect(applicant.getByRole("button", { name: "合适", exact: true })).toHaveAttribute("aria-pressed", "true");

  await seeker.goto("/me/saved");
  const mine = seeker.getByRole("region", { name: /^我的申请/ }).getByRole("article", { name: title });
  await expect(mine).toContainText("雇主觉得合适");
  await expect(mine).toContainText("附言：周末都能上班");
  await expect(mine.getByRole("button")).toHaveCount(0); // nothing to withdraw
  await seeker.context().close();
});
