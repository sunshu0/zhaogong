// 约面试 (#103): the employer offers any times (or 电话联系后再定) from the applicant list; the job seeker confirms
// one, says what suits, or declines, from 我的申请; each side hears of the other in 通知 and 待办; a confirmed time
// downloads as a calendar file.
import { readFile } from "node:fs/promises";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { chooseOption, freshEmail, signIn } from "./helpers";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";
import { instantToAuckland } from "../src/components/seeker/interviews";

/** An Auckland wall-clock time `days` from now at hh:mm, as a datetime-local field takes it. */
function ahead(days: number, hour: number, minute = 0) {
  const date = instantToAuckland(new Date(Date.now() + days * 86_400_000).toISOString()).slice(0, 10);
  return { local: `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}` };
}

/** The employer publishes a job and a job seeker, in their own browser, applies for it. */
async function applied(page: Page, browser: Browser, testInfo: TestInfo) {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("面试服务员", testInfo);
  const jobId = await publishJob(page, title);
  const seeker = await (await browser.newContext({ ...testInfo.project.use, acceptDownloads: true })).newPage();
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("demo.interview")); // starts with 林晓's demo page (#125)
  await seeker.getByRole("button", { name: "申请", exact: true }).click();
  const form = seeker.getByRole("dialog", { name: /申请这个职位|我的申请/ });
  await form.getByRole("button", { name: "提交申请" }).click();
  await expect(form.getByRole("status")).toHaveText("已申请，等雇主查看");
  await page.goto(`/employer/jobs/${jobId}/applicants`);
  const applicant = page.getByRole("article", { name: "申请人 林晓" });
  await expect(applicant).toBeVisible();
  return { title, jobId, seeker, applicant };
}

const mine = (seeker: Page, title: string) =>
  seeker.getByRole("region", { name: /^我的申请/ }).getByRole("article", { name: title });

test("the employer offers two times; the job seeker confirms one and saves it to a calendar", async ({
  page,
  browser,
}, testInfo) => {
  const { title, seeker, applicant } = await applied(page, browser, testInfo);
  const first = ahead(3, 10, 30);
  const second = ahead(4, 15, 15);

  await applicant.getByRole("button", { name: "约面试" }).click();
  const form = applicant.getByRole("form", { name: "约林晓面试" });
  await form.getByLabel("时间 1", { exact: true }).fill(first.local);
  await form.getByRole("button", { name: "再加一个时间" }).click();
  await form.getByLabel("时间 2", { exact: true }).fill(second.local);
  await chooseOption(page, form, "面试方式（选填）", "到店面试");
  await form.getByLabel("地点或说明（选填）").fill("到店找王经理");
  await form.getByLabel("附言（选填）").fill("带上简历");
  await expect(form).toContainText("邀约里不带你的联系方式");
  await form.getByRole("button", { name: "发出邀约" }).click();
  const status = applicant.getByRole("status", { name: "和林晓的面试" });
  await expect(status).toContainText("已发邀约，等对方确认");

  await page.goto("/workspace");
  await expect(page.getByRole("link", { name: /待确认的面试：林晓/ })).toBeVisible();

  // The job seeker: 通知, then 我的申请.
  await seeker.goto("/notifications");
  await expect(
    seeker
      .getByText(/邀请你面试/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await seeker.goto("/workspace");
  await expect(seeker.getByRole("link", { name: /待确认的面试：/ })).toBeVisible();
  await seeker.goto("/me/saved");
  const invitation = mine(seeker, title).getByRole("region", { name: "面试邀约" });
  await expect(invitation).toContainText("邀请你面试，请选一个时间");
  await expect(invitation).toContainText("到店面试 · 到店找王经理");
  await expect(invitation).toContainText("雇主附言：带上简历");
  const options = invitation.getByRole("radio");
  await expect(options).toHaveCount(2);
  await options.nth(1).check();
  await invitation.getByRole("button", { name: "确认这个时间" }).click();
  await expect(invitation).toContainText("面试已确认：");
  const confirmed = (await invitation.textContent())!;
  expect(confirmed).toMatch(/面试已确认：\d+月\d+日周. 15:15/);

  const download = seeker.waitForEvent("download");
  await invitation.getByRole("button", { name: "下载日历文件（.ics）" }).click();
  const ics = await readFile((await (await download).path())!, "utf8");
  expect(ics).toContain("BEGIN:VEVENT");
  expect(ics).toMatch(/DTSTART:\d{8}T\d{6}Z/);
  expect(ics).toContain("LOCATION:到店找王经理");

  // The employer hears back.
  await page.goto("/notifications");
  await expect(
    page
      .getByText(/林晓确认了「.*」的面试/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await seeker.context().close();
});

test("电话联系后再定, the job seeker's own times, new times, a past time refused, and cancelling", async ({
  page,
  browser,
}, testInfo) => {
  const { title, jobId, seeker, applicant } = await applied(page, browser, testInfo);
  await applicant.getByRole("button", { name: "约面试" }).click();
  const form = applicant.getByRole("form", { name: "约林晓面试" });
  await form.getByRole("radio", { name: "电话联系后再定" }).check();
  await form.getByRole("button", { name: "发出邀约" }).click();
  await expect(applicant.getByRole("status", { name: "和林晓的面试" })).toContainText("已发邀约");

  await seeker.goto("/me/saved");
  const invitation = mine(seeker, title).getByRole("region", { name: "面试邀约" });
  await expect(invitation).toContainText("邀请你面试，时间电话联系后再定");
  await invitation.getByRole("button", { name: "说说我方便的时间" }).click();
  await invitation.getByLabel("我方便的时间").fill("周四下午、周末都可以");
  await invitation.getByRole("button", { name: "发给雇主" }).click();
  await expect(invitation).toContainText("你回了方便的时间，等雇主回复");

  await page.goto("/workspace");
  await expect(page.getByRole("link", { name: /林晓回了方便的时间/ })).toBeVisible();
  await page.goto(`/employer/jobs/${jobId}/applicants`);
  const status = applicant.getByRole("status", { name: "和林晓的面试" });
  await expect(status).toContainText("对方说这些时间不行：「周四下午、周末都可以」");

  // A time already past cannot be picked (the field's minimum is now; the server refuses one too); then a new time.
  await applicant.getByRole("button", { name: "改时间" }).click();
  const change = applicant.getByRole("form", { name: "约林晓面试" });
  await change.getByRole("radio", { name: "给具体时间" }).check();
  await change.getByLabel("时间 1", { exact: true }).fill(ahead(-2, 9).local);
  await change.getByRole("button", { name: "发出新的邀约" }).click();
  expect(
    await change
      .getByLabel("时间 1", { exact: true })
      .evaluate((input) => (input as HTMLInputElement).validity.rangeUnderflow),
  ).toBe(true);
  await expect(status).toContainText("对方说这些时间不行");
  await change.getByLabel("时间 1", { exact: true }).fill(ahead(5, 9).local);
  await change.getByRole("button", { name: "发出新的邀约" }).click();
  await expect(status).toContainText("已发邀约，等对方确认");

  await seeker.reload();
  await expect(invitation).toContainText("邀请你面试，请选一个时间");
  await expect(invitation.getByRole("radio")).toHaveCount(1);

  await applicant.getByRole("button", { name: "取消面试" }).click();
  await expect(status).toContainText("你已取消这次面试");
  await expect(applicant.getByRole("button", { name: "约面试" })).toBeVisible();
  await seeker.reload();
  await expect(invitation).toContainText("雇主取消了这次面试");
  await expect(invitation.getByRole("button", { name: "确认这个时间" })).toHaveCount(0);
  await seeker.goto("/notifications");
  await expect(
    seeker
      .getByText(/的面试取消了/)
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
  await seeker.context().close();
});
