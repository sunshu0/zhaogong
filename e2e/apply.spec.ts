// 一键申请 (#84, R-35): a job seeker applies with a note; the business sees the applicant on 职位管理, in 待办 and 通知,
// opens the list, chats, marks 合适 / 不合适; the job seeker sees only 雇主已看过 or 雇主觉得合适, and can withdraw.
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { fillSignInCode, freshEmail, signIn } from "./helpers";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

async function seekerPage(browser: Browser, testInfo: TestInfo): Promise<Page> {
  return (await browser.newContext({ ...testInfo.project.use })).newPage();
}

const applyDialog = (page: Page) => page.getByRole("dialog", { name: /申请这个职位|我的申请/ });

test("apply with a note; the employer sees, chats and decides; the job seeker sees how far it got", async ({
  page,
  browser,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("申请服务员", testInfo);
  const jobId = await publishJob(page, title);
  expect(jobId).toMatch(/^j\d+$/);

  // The job seeker: the form shows the page employers will see, without contact details; then 提交申请.
  const seeker = await seekerPage(browser, testInfo);
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("demo.apply")); // starts with 林晓's demo page (#125)
  await seeker.getByRole("button", { name: "申请", exact: true }).click();
  const form = applyDialog(seeker);
  await expect(form.getByRole("region", { name: "雇主会看到的资料" })).toContainText("林晓");
  await expect(form).toContainText("申请不会把你的电话、微信或邮箱给雇主");
  await form.getByLabel("附言（选填）").fill("周末都能上班");
  await form.getByRole("button", { name: "提交申请" }).click();
  await expect(form.getByRole("status")).toHaveText("已申请，等雇主查看");
  await form.getByRole("button", { name: "好的" }).click();
  await expect(seeker.getByRole("button", { name: "已申请 · 已申请，等雇主查看" })).toBeVisible();

  // The business: 待办, then the card on 职位管理, then the list.
  await page.goto("/workspace");
  const todo = page.getByRole("link", { name: /1 个新申请/ });
  await expect(todo).toBeVisible();
  await page.goto("/employer/jobs");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await card.getByRole("link", { name: "1 个申请 · 1 个新" }).click();
  await expect(page).toHaveURL(`/employer/jobs/${jobId}/applicants`);
  const applicant = page.getByRole("article", { name: "申请人 林晓" });
  await expect(applicant).toContainText("附言：周末都能上班");
  await expect(applicant).toContainText("可上班时间");
  await expect(applicant.getByText("新", { exact: true })).toBeVisible();
  await applicant.getByRole("button", { name: "不合适" }).click();
  await expect(applicant.getByRole("button", { name: "不合适" })).toHaveAttribute("aria-pressed", "true");

  // 不合适 reads 雇主已看过 for the job seeker.
  await seeker.reload();
  await expect(seeker.getByRole("button", { name: "已申请 · 雇主已看过" })).toBeVisible();

  await applicant.getByRole("button", { name: "合适", exact: true }).click();
  await expect(applicant.getByRole("button", { name: "合适", exact: true })).toHaveAttribute("aria-pressed", "true");
  // The pills above the list show one kind at a time (#192).
  const filters = page.getByRole("tablist", { name: "按处理状态" });
  await filters.getByRole("tab", { name: "未处理 0" }).click();
  await expect(page.getByText("这一类还没有人。")).toBeVisible();
  await filters.getByRole("tab", { name: "合适 1" }).click();
  await expect(applicant).toBeVisible();
  await filters.getByRole("tab", { name: "全部 1" }).click();
  await seeker.goto("/me/saved");
  const mine = seeker.getByRole("region", { name: /^我的申请/ }).getByRole("article", { name: title });
  await expect(mine).toContainText("雇主觉得合适");
  await expect(mine).toContainText("附言：周末都能上班");

  // 发起聊天 opens the chat the job seeker has too (#110).
  await applicant.getByRole("button", { name: "发起聊天" }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=chat%3A/);
  await expect(page.getByRole("main").getByText("林晓").filter({ visible: true }).first()).toBeVisible();

  // Withdrawn: gone from the employer's list.
  await mine.getByRole("button", { name: "撤回申请" }).click();
  await expect(seeker.getByRole("region", { name: /^我的申请/ })).toHaveCount(0);
  await seeker.context().close();
  await page.goto(`/employer/jobs/${jobId}/applicants`);
  await expect(page.getByText("还没有人申请这个职位。")).toBeVisible();
});

test("signed out, 申请 signs in and comes back with the form open; a job row shows 已申请", async ({ page }) => {
  await page.goto("/jobs/j3");
  await page.getByRole("link", { name: "申请", exact: true }).click();
  await expect(page).toHaveURL(/\/login\?role=seeker&next=/);
  await page.getByLabel("邮箱", { exact: true }).fill(freshEmail("demo.apply"));
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs/j3"); // the flag leaves the address once the form is open
  const form = applyDialog(page);
  await expect(form.getByRole("heading", { name: "申请这个职位" })).toBeVisible();
  await form.getByRole("button", { name: "提交申请" }).click();
  await expect(form.getByRole("status")).toHaveText("已申请，等雇主查看");
  await page.keyboard.press("Escape");
  await expect(form).toHaveCount(0);

  await page.goto("/jobs?q=%E7%82%B9%E5%BF%83");
  const row = page.getByRole("region", { name: "职位列表" }).getByRole("article").filter({ hasText: "点心师傅" });
  await expect(row.getByText("已申请", { exact: true })).toBeVisible();
});

test("no 申请 for the business's own job, and none on the rows for employers", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("自家职位", testInfo);
  const jobId = await publishJob(page, title);
  await page.goto(`/jobs/${jobId}`);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  await expect(page.getByRole("link", { name: "管理本企业职位" }).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^申请/ })).toHaveCount(0);
  await page.goto("/jobs");
  await expect(page.getByRole("region", { name: "职位列表" }).getByRole("article").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /^申请：/ })).toHaveCount(0);
});
