import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import {
  CLEAN_MESSAGE,
  openTheForm,
  publishJob,
  signUpEmployer,
  uniqueTitle,
  openReportForm,
  cardMenuItem,
  moderatorPage,
  setJobClosing,
} from "./helpers";
import { applyForTest, freshEmail, signIn } from "../helpers";

// Round 19 pages pop in and fade (animate-pop-in, transitions): axe scans the settled page, as with "reduce motion",
// not one caught mid-animation with half-faded colours.
test.use({ reducedMotion: "reduce" });

// axe on every employer and moderation page, in the states people actually see, at 375 px and
// 1280 px (the two projects). WCAG 2.1 A and AA, no exceptions.
/**
 * #257: every visible text box in `scope` has text of 16px or more, so iPhone does not zoom in when it is focused.
 * Measured on the phone project, where the body text is 14-15px.
 */
async function expectNoZoomOnFocus(page: Page, scope: string, state: string) {
  const small = await page.locator(scope).evaluate((root) =>
    Array.from(root.querySelectorAll<HTMLElement>("input:not([type=checkbox]):not([type=radio]), textarea"))
      .filter((box) => box.offsetParent !== null)
      .map((box) => ({
        name: box.id || box.getAttribute("aria-label") || box.outerHTML.slice(0, 60),
        px: parseFloat(getComputedStyle(box).fontSize),
      }))
      .filter((box) => box.px < 16),
  );
  expect(small, `text boxes under 16px on ${state}`).toEqual([]);
}

async function expectNoViolations(page: Page, state: string) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const found = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `    ${n.target.join(" ")} — ${n.failureSummary?.split("\n").join(" ")}`).join("\n")}`,
  );
  expect.soft(found, `${state}\n${found.join("\n")}`).toEqual([]);
}

test("post flow, every step", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  await page.goto("/employer/post");
  await expectNoViolations(page, "post: chat, greeting");
  await page.getByLabel("回复助手").fill("奶茶店招兼职店员，市中心，时薪 18，入职交押金200。学签OK。微信 cbdtea_demo");
  await page.getByRole("button", { name: "发送" }).click();
  await expect(
    page
      .getByRole("button", { name: "删掉这句" })
      .or(page.getByText("时薪改成多少").filter({ visible: true }))
      .first(),
  ).toBeVisible();
  await expectNoViolations(page, "post: chat, a compliance question");

  // After chatting, 直接填表 opens the form with the chat's draft; start over for the paste step.
  await page.goto("/employer/post");
  await openTheForm(page);
  await expectNoViolations(page, "post: paste step");

  await page
    .getByLabel(/把微信群里的招聘消息粘贴进来/)
    .fill("奶茶店招兼职店员，市中心，时薪 20，入职交押金200，限华人。学签OK。微信 cbdtea_demo");
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
  await expectNoViolations(page, "post: preview");

  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已发布" })).toBeVisible();
  await expectNoViolations(page, "post: published, share texts");
});

test("employer home, manage jobs and verification", async ({ page }, testInfo) => {
  await page.goto("/employer");
  await expectNoViolations(page, "/employer signed out");

  await signUpEmployer(page, testInfo, "/employer");
  await publishJob(page, uniqueTitle("前厅服务员", testInfo));
  await page.goto("/employer");
  // In the page: on phones the bottom bar has a 职位管理 link too.
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: /^职位管理/ })
      .filter({ visible: true }),
  ).toBeVisible();
  await expectNoViolations(page, "/employer signed in");

  await page.goto("/employer/jobs");
  const card = page.getByRole("article").first();
  await (await cardMenuItem(card, "结束招聘")).click();
  await (await cardMenuItem(card, "复制文案")).click();
  await card.getByRole("button", { name: /^更多操作/ }).click(); // the menu open too
  await expectNoViolations(page, "/employer/jobs with confirm and share open");

  await page.goto("/employer/verify");
  await page.getByLabel("公司名称或 NZBN").fill("demo");
  await page.getByRole("button", { name: "查询" }).click();
  // The signed-in shop's own NZBN is also in the header, so wait for the result line itself.
  await expect(page.getByText("NZBN 9429000000001 · 商号：川味小馆").filter({ visible: true })).toBeVisible();
  // #262: how many it found is said, above the results.
  await expect(page.getByRole("status").filter({ hasText: /^找到 \d+ 家公司，选一家你的。$/ })).toBeVisible();
  await expectNoViolations(page, "/employer/verify with results");
  await page.getByRole("button", { name: "这是我的公司", disabled: false }).first().click();
  await expectNoZoomOnFocus(page, "main", "/employer/verify with the form open");

  // 团队 (#87): the admin's view, with the invite form.
  await page.goto("/employer/team");
  await expect(page.getByRole("button", { name: "发送邀请" })).toBeVisible();
  await expectNoViolations(page, "/employer/team");
});

// #170: a job's own pages, the empty back office and a shared résumé.
test("before the first job, then a job's own pages: edit, applicants and the interview form, numbers, republish", async ({
  page,
  browser,
}, testInfo) => {
  await signUpEmployer(page, testInfo, "/employer");
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: /^职位管理/ })
      .filter({ visible: true }),
  ).toBeVisible();
  await expectNoViolations(page, "/employer before the first job");
  await page.goto("/employer/jobs");
  await expect(page.getByRole("heading", { name: "职位管理", level: 1 })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expectNoViolations(page, "/employer/jobs before the first job");

  const jobId = (await publishJob(page, uniqueTitle("前厅服务员", testInfo)))!;
  // A demo job seeker (林晓's page, #125) applies, so 申请人 has someone.
  const seeker = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("demo.a11y"));
  await applyForTest(seeker, jobId);
  await seeker.context().close();

  await page.goto(`/employer/jobs/${jobId}`);
  await expect(page.getByRole("heading", { name: "编辑职位", level: 1 })).toBeVisible();
  await expect(page.getByLabel("职位名称（中文）")).toBeVisible();
  await expectNoViolations(page, "/employer/jobs/[id] edit");

  await page.goto(`/employer/jobs/${jobId}/applicants`);
  const applicant = page.getByRole("article", { name: "申请人 林晓" });
  await expect(applicant).toBeVisible();
  await expectNoViolations(page, "/employer/jobs/[id]/applicants");
  await applicant.getByRole("button", { name: "约面试" }).click();
  await expect(applicant.getByRole("form", { name: "约林晓面试" })).toBeVisible();
  // #248: the form took the place of the pressed button, and its focus.
  await expect(applicant.getByRole("form", { name: "约林晓面试" }).locator(":focus")).toHaveCount(1);
  await expectNoZoomOnFocus(page, "main", "the interview form");
  await expectNoViolations(page, "/employer/jobs/[id]/applicants with the interview form");
  // #304: the two ways to give the time are one group, so the arrow key moves the choice.
  const times = applicant.getByRole("form", { name: "约林晓面试" }).getByRole("radio");
  await times.first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(times.nth(1)).toBeChecked();
  await expect(times.nth(1)).toBeFocused();

  await page.goto(`/employer/jobs/${jobId}/stats`);
  await expect(page.getByRole("heading", { name: "职位数据", level: 1 })).toBeVisible();
  await expectNoViolations(page, "/employer/jobs/[id]/stats");

  await setJobClosing(page, jobId, -20);
  await page.goto(`/employer/jobs/${jobId}/republish`);
  await expect(page.getByRole("heading", { name: "重新发布" })).toBeVisible();
  await expect(page.getByLabel("职位名称（中文）")).not.toHaveValue("");
  await expectNoViolations(page, "/employer/jobs/[id]/republish");
});

test("a shared résumé, as someone who is not signed in sees it", async ({ page, browser }, testInfo) => {
  await signIn(page, "/profile/resume", `demo.a11y.resume.${testInfo.project.name}.${Date.now()}@example.com`);
  await page.getByRole("button", { name: "生成分享链接" }).click();
  const link = page.locator("#resume-share").getByRole("link", { name: /\/resume\// });
  await expect(link).toBeVisible();
  const stranger = await (await browser.newContext({ ...testInfo.project.use, reducedMotion: "reduce" })).newPage();
  await stranger.goto(new URL((await link.textContent())!).pathname);
  await expect(stranger.getByText("林晓").first()).toBeVisible();
  await expectNoViolations(stranger, "/resume/[id] shared");
  await stranger.goto("/resume/no-such-share-link-000000");
  await expect(stranger.getByRole("heading", { name: "这份简历的分享链接已关闭或不存在" })).toBeVisible();
  await expectNoViolations(stranger, "/resume/[id] closed or missing");
  await stranger.context().close();
});

test("moderation queue, each tab", async ({ browser, page }, testInfo) => {
  const title = uniqueTitle("前厅服务员", testInfo);
  await signUpEmployer(page, testInfo);
  const id = await publishJob(page, title);
  await publishJob(
    page,
    uniqueTitle("前厅服务员", testInfo),
    CLEAN_MESSAGE.replace("Mt Eden 川菜馆", "Mt Eden KTV 楼下川菜馆"),
  );
  await page.goto(`/jobs/${id}`);
  await openReportForm(page);
  await page.getByRole("group", { name: "举报这个职位" }).getByLabel("虚假职位").check();
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");

  await page.goto("/admin");
  await expect(page.getByText("只有审核员能使用审核后台。", { exact: true })).toBeVisible();
  await expectNoViolations(page, "/admin refused");

  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await expect(admin.getByRole("article").first()).toBeVisible();
  await expectNoViolations(admin, "/admin flagged");
  await admin.getByRole("tab", { name: /被举报/ }).click();
  await admin
    .getByRole("article")
    .filter({ has: admin.getByRole("heading", { name: title }) })
    .getByRole("button", { name: "下架" })
    .click();
  await expect(admin.getByRole("status")).toContainText("已处理");
  await expectNoViolations(admin, "/admin after an action");
  await admin.getByRole("tab", { name: /操作记录/ }).click();
  await expectNoViolations(admin, "/admin log");
  await admin.getByRole("tab", { name: "审核员" }).click();
  await expect(admin.getByLabel("邮箱")).toBeVisible();
  await expectNoViolations(admin, "/admin moderators");
  await admin.context().close();
});
