import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { fillSignInCode, freshEmail, siteNav } from "./helpers";
import { instantToAuckland } from "../src/components/seeker/interviews";
import {
  CLEAN_MESSAGE,
  moderatorPage,
  openReportForm,
  openTheForm,
  setJobClosing,
  uniqueTitle,
} from "./employer/helpers";

// 入口走查 (#75): every feature reached the way a person would — from the home page, by clicking. The only
// page.goto in this file is the one to "/". Other specs open deep addresses directly, which is how /admin shipped
// with no way in (#73). Both projects run it: the phone (375 px, bottom bar) and the desktop (1280 px, header).

const isPhone = (testInfo: TestInfo) => testInfo.project.name === "mobile";

/** Signs in from the page in view: 我的 in the bottom bar on a phone, 登录 / 注册 in the header on a desktop. */
async function signInByClicks(page: Page, testInfo: TestInfo, email = freshEmail("walk")) {
  if (isPhone(testInfo)) await siteNav(page).getByRole("link", { name: "我的", exact: true }).click();
  else await page.getByRole("banner").getByRole("link", { name: "登录 / 注册" }).click();
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return email;
}

/**
 * Opens one of the job seeker's own pages by clicking: on a phone 我的 in the bottom bar, then the page in its list;
 * on a desktop 工作台 in the header, then the page in the workspace sidebar.
 */
async function openMine(page: Page, testInfo: TestInfo, label: string) {
  if (isPhone(testInfo)) {
    await siteNav(page).getByRole("link", { name: "我的", exact: true }).click();
    await expect(page).toHaveURL("/account");
    await page
      .getByRole("main")
      .getByRole("link", { name: new RegExp(`^${label}`) })
      .click();
    return;
  }
  await siteNav(page).getByRole("link", { name: "工作台", exact: true }).click();
  await expect(page).toHaveURL("/workspace");
  await page.getByRole("navigation", { name: "工作台导航" }).getByRole("link", { name: label, exact: true }).click();
}

/** From the home page to the full job list. */
async function toJobList(page: Page) {
  await page.getByRole("main").getByRole("link", { name: "查看全部职位 →" }).click();
  await expect(page).toHaveURL("/jobs");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("举报职位: home → a job → 举报这个职位", async ({ page }, testInfo) => {
  await signInByClicks(page, testInfo);
  await siteNav(page)
    .getByRole("link", { name: /^(职位|找工作)$/ })
    .click();
  await expect(page).toHaveURL("/jobs");
  const first = page.getByRole("region", { name: "职位列表" }).getByRole("article").first();
  await first.getByRole("heading").getByRole("link").click();
  await expect(page).toHaveURL(/\/jobs\/j\d+$/);
  await openReportForm(page);
  await page.getByRole("group", { name: "举报这个职位" }).getByLabel("其他").check();
  await page.getByLabel("补充说明（选填）").fill(`入口走查 ${testInfo.project.name}`);
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");
});

test("收藏和进度: home → 收藏 a job → 收藏和进度", async ({ page }, testInfo) => {
  await signInByClicks(page, testInfo);
  await page.getByRole("link", { name: "找工" }).first().click(); // back to the home page by its logo
  await toJobList(page);
  const first = page.getByRole("region", { name: "职位列表" }).getByRole("article").first();
  const title = (await first.getByRole("heading").textContent())!.trim();
  await first.getByRole("button", { name: /^收藏：/ }).click();
  await expect(first.getByRole("button", { name: /^收藏：/ })).toHaveText("已收藏");

  await openMine(page, testInfo, "收藏和进度");
  await expect(page).toHaveURL("/me/saved");
  await expect(page.getByRole("main")).toContainText(title);
});

test("职位提醒: home → a quick filter → 保存为提醒 → 管理提醒, and back in through 职位提醒", async ({
  page,
}, testInfo) => {
  await signInByClicks(page, testInfo);
  await page.getByRole("link", { name: "找工" }).first().click();
  await page.getByRole("main").getByRole("link", { name: "包餐", exact: true }).click();
  await expect(page).toHaveURL("/jobs?meals=1");
  await page.getByRole("button", { name: "保存为提醒" }).click();
  await page.getByRole("status").getByRole("link", { name: "管理提醒" }).click();
  await expect(page).toHaveURL("/me/alerts");
  await expect(page.getByRole("article", { name: "提醒：包餐" })).toBeVisible();

  await page.getByRole("link", { name: "找工" }).first().click();
  await openMine(page, testInfo, "职位提醒");
  await expect(page).toHaveURL("/me/alerts");
  await expect(page.getByRole("article", { name: "提醒：包餐" })).toBeVisible();
});

test("导出数据和删除账号: home → 数据与账号 → download, then delete", async ({ page }, testInfo) => {
  const email = await signInByClicks(page, testInfo);
  if (isPhone(testInfo)) {
    await openMine(page, testInfo, "数据与账号");
  } else {
    // A desktop has two ways in (#76): the account menu, and the workspace sidebar, which marks the page.
    await page.getByRole("button", { name: /^账号菜单/ }).click();
    await page.getByRole("link", { name: "数据与账号", exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: "工作台导航" }).getByRole("link", { name: "数据与账号", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  }
  await expect(page).toHaveURL("/account/data");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载我的数据" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);

  await page.getByLabel(/输入你的登录邮箱/).fill(email);
  await page.getByRole("button", { name: "永久删除账号" }).click();
  await expect(page.getByText("账号已删除")).toBeVisible();
});

/** From the home page: 发布招聘 → sign up → open a new business → publish a job titled `title`. Ends on 已发布. */
async function openShopAndPublish(page: Page, testInfo: TestInfo, title: string): Promise<string> {
  const run = `${isPhone(testInfo) ? "M" : "D"}${testInfo.workerIndex}${Date.now() % 1_000_000}`;
  await page.getByRole("banner").getByRole("link", { name: "发布招聘" }).click();
  await page.getByLabel("邮箱", { exact: true }).fill(`walk.boss.${run}@example.com`);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("radio", { name: /新建企业/ }).check();
  await page.getByLabel("店名", { exact: true }).fill(`走查店${run}`);
  await page.getByRole("combobox", { name: /^地区/ }).selectOption({ label: "市中心" });
  await page.getByRole("button", { name: "开通并开始发布招聘" }).click();
  await expect(page).toHaveURL("/employer/post");

  await openTheForm(page);
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await page.getByRole("button", { name: "整理成职位" }).click();
  await page.getByLabel("职位名称（中文）").fill(title);
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已发布" })).toBeVisible();
  const href = await page.getByRole("link", { name: "看看职位页面" }).getAttribute("href");
  return href!.split("/").pop()!;
}

test("雇主职位数据: home → 发布招聘 → publish → 职位管理 → 近 14 天", async ({ page }, testInfo) => {
  const title = uniqueTitle("走查服务员", testInfo);
  await openShopAndPublish(page, testInfo, title);

  // The bottom bar is hidden while posting (hidesBottomNav); the 已发布 screen links to 职位管理 itself.
  await page.getByRole("main").getByRole("link", { name: "职位管理", exact: true }).click();
  await expect(page).toHaveURL("/employer/jobs");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card).toContainText("次浏览");
  await card.getByRole("link", { name: "近 14 天" }).click();
  await expect(page).toHaveURL(/\/employer\/jobs\/j\d+\/stats$/);
  await expect(page.getByRole("heading", { name: "职位数据" })).toBeVisible();

  // The employer identity reaches 数据与账号 too (#76): 我的 on a phone, the account menu on a desktop.
  if (isPhone(testInfo)) await siteNav(page).getByRole("link", { name: "我的", exact: true }).click();
  else await page.getByRole("button", { name: /^账号菜单/ }).click();
  await page.getByRole("link", { name: /^数据与账号/ }).click();
  await expect(page).toHaveURL("/account/data");
});

/**
 * By clicks: an employer opens a shop and posts a job; a job seeker, in another browser, finds it from the home
 * page and applies. The seeker's page stays open for the caller.
 */
async function postAndApplyByClicks(page: Page, browser: Browser, testInfo: TestInfo, base: string) {
  // The employer posts a job, by clicks from the home page.
  const run = `${isPhone(testInfo) ? "M" : "D"}${testInfo.workerIndex}${Date.now() % 1_000_000}`;
  await page.getByRole("banner").getByRole("link", { name: "发布招聘" }).click();
  await page.getByLabel("邮箱", { exact: true }).fill(`walk.apply.boss.${run}@example.com`);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("radio", { name: /新建企业/ }).check();
  await page.getByLabel("店名", { exact: true }).fill(`申请走查店${run}`);
  await page.getByRole("combobox", { name: /^地区/ }).selectOption({ label: "市中心" });
  await page.getByRole("button", { name: "开通并开始发布招聘" }).click();
  await expect(page).toHaveURL("/employer/post");
  const title = uniqueTitle(base, testInfo);
  await openTheForm(page);
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await page.getByRole("button", { name: "整理成职位" }).click();
  await page.getByLabel("职位名称（中文）").fill(title);
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已发布" })).toBeVisible();

  // A job seeker, in another browser: home → sign in → home → search → the job → 申请.
  const seeker = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await seeker.goto("/");
  await signInByClicks(seeker, testInfo, freshEmail("demo.walk")); // starts with 林晓's demo page (#125)
  await seeker.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  const hero = seeker.getByRole("region", { name: /^奥克兰的中文工作/ });
  await hero.getByRole("searchbox", { name: "搜索职位" }).fill(title);
  await hero.getByRole("button", { name: "找工作" }).click();
  await seeker.getByRole("main").getByRole("link", { name: title, exact: true }).click();
  await expect(seeker).toHaveURL(/\/jobs\/j\d+$/);
  await seeker.getByRole("button", { name: "申请", exact: true }).click();
  const form = seeker.getByRole("dialog", { name: "申请这个职位" });
  await form.getByLabel("附言（选填）").fill("入口走查");
  await form.getByRole("button", { name: "提交申请" }).click();
  await expect(seeker.getByRole("dialog").getByRole("status")).toHaveText("已申请，等雇主查看");
  return { title, seeker };
}

test("一键申请: home → search → a job → 申请; the employer: 总览 → 1 个新申请 → 合适 (#84)", async ({
  page,
  browser,
}, testInfo) => {
  const { seeker } = await postAndApplyByClicks(page, browser, testInfo, "申请走查员");
  await seeker.context().close();

  // The employer: home → 总览 → 「1 个新申请」 → 申请人 → 合适.
  await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  await openMine(page, testInfo, "总览");
  await expect(page).toHaveURL("/workspace");
  await page.getByRole("link", { name: /1 个新申请/ }).click();
  await expect(page).toHaveURL(/\/employer\/jobs\/j\d+\/applicants$/);
  const applicant = page.getByRole("article", { name: /^申请人 / });
  await expect(applicant).toContainText("附言：入口走查");
  await applicant.getByRole("button", { name: "合适", exact: true }).click();
  await expect(applicant.getByRole("button", { name: "合适", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("时薪参考: home → a job → 同类职位时薪; 发布招聘 → 直接填表 → beside 时薪 (#85)", async ({ page }, testInfo) => {
  await toJobList(page);
  await page
    .getByRole("region", { name: "职位列表" })
    .getByRole("article")
    .first()
    .getByRole("heading")
    .getByRole("link")
    .click();
  await expect(page).toHaveURL(/\/jobs\/j\d+$/);
  await expect(page.getByRole("region", { name: "同类职位时薪" })).toContainText("根据平台上");

  await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  const run = `${isPhone(testInfo) ? "M" : "D"}${testInfo.workerIndex}${Date.now() % 1_000_000}`;
  await page.getByRole("banner").getByRole("link", { name: "发布招聘" }).click();
  await page.getByLabel("邮箱", { exact: true }).fill(`walk.pay.${run}@example.com`);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("radio", { name: /新建企业/ }).check();
  await page.getByLabel("店名", { exact: true }).fill(`时薪走查店${run}`);
  await page.getByRole("combobox", { name: /^地区/ }).selectOption({ label: "市中心" });
  await page.getByRole("button", { name: "开通并开始发布招聘" }).click();
  await expect(page).toHaveURL("/employer/post");
  await openTheForm(page);
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await page.getByRole("button", { name: "整理成职位" }).click();
  await expect(page.getByRole("region", { name: "同类职位时薪" })).toContainText("餐饮");
});

test("职位续期: home → 工作台 → 快截止的职位 → 将截止 → 续期 (#69)", async ({ page }, testInfo) => {
  const title = uniqueTitle("走查续期", testInfo);
  const jobId = await openShopAndPublish(page, testInfo, title);
  await setJobClosing(page, jobId, 2.5); // three days are not waited for: the job is moved closer to its closing date

  // Home by the logo, then the workspace: 我的 → 总览 on a phone, 工作台 in the header on a desktop.
  await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  await expect(page).toHaveURL("/");
  if (isPhone(testInfo)) {
    await siteNav(page).getByRole("link", { name: "我的", exact: true }).click();
    await page.getByRole("main").getByRole("link", { name: /^总览/ }).click();
  } else {
    await siteNav(page).getByRole("link", { name: "工作台", exact: true }).click();
  }
  await expect(page).toHaveURL("/workspace");
  await page.getByRole("link", { name: new RegExp(`「${title}」3 天后截止`) }).click();

  await expect(page).toHaveURL("/employer/jobs?tab=ending");
  await expect(page.getByRole("tab", { name: /^将截止/ })).toHaveAttribute("aria-selected", "true");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await card.getByRole("button", { name: "续期", exact: true }).click();
  await card.getByRole("group", { name: "续期多久？" }).getByRole("button", { name: "确定续期" }).click();
  await expect(page.getByRole("status")).toContainText(`${title}：已续期 30 天`);
});

test("企业验证: home → 工作台 → 企业验证 → 提交审核; a moderator: home → 审核后台 → 企业验证 (#78)", async ({
  page,
  browser,
}, testInfo) => {
  await openShopAndPublish(page, testInfo, uniqueTitle("走查验证", testInfo));
  await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  await expect(page).toHaveURL("/");
  if (isPhone(testInfo)) {
    await siteNav(page).getByRole("link", { name: "我的", exact: true }).click();
    await page
      .getByRole("main")
      .getByRole("link", { name: /^企业验证/ })
      .click();
  } else {
    await siteNav(page).getByRole("link", { name: "工作台", exact: true }).click();
    await page
      .getByRole("navigation", { name: "工作台导航" })
      .getByRole("link", { name: "企业验证", exact: true })
      .click();
  }
  await expect(page).toHaveURL("/employer/verify");
  // An NZBN of the demo register's own range (9429999xxxxxx), so no other test has applied with it.
  const digits = `${isPhone(testInfo) ? 3 : 4}${testInfo.workerIndex % 10}${Date.now() % 10_000}`;
  await page.getByLabel("公司名称或 NZBN").fill(`9429999${digits.padStart(6, "0").slice(-6)}`);
  await page.getByRole("button", { name: "查询" }).click();
  await page.getByRole("button", { name: "这是我的公司" }).click();
  await page.getByLabel(/联系人姓名/).fill("走查店主");
  await page.getByLabel(/你在公司的职务/).fill("店主");
  await page.getByLabel(/^公司电话/).fill("09 555 0777");
  await page.getByRole("button", { name: "提交审核" }).click();
  await expect(page.getByRole("region", { name: "验证申请" })).toContainText("验证审核中");

  // The demo moderator, from the home page as well (signed in once by the setup project).
  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/");
  if (isPhone(testInfo)) {
    // Until the page has read the session, 我的 goes through sign-in (nav.ts); wait for the signed-in link.
    const mine = siteNav(admin).getByRole("link", { name: "我的", exact: true });
    await expect(mine).toHaveAttribute("href", "/account");
    await mine.click();
    await admin
      .getByRole("main")
      .getByRole("link", { name: /^审核后台/ })
      .click();
  } else {
    await admin
      .getByRole("banner")
      .getByRole("button", { name: /^账号菜单/ })
      .click();
    await admin.locator("#account-menu").getByRole("link", { name: "审核后台" }).click();
  }
  await expect(admin).toHaveURL("/admin");
  await admin.getByRole("tab", { name: /^企业验证/ }).click();
  await expect(admin.getByRole("article", { name: /^企业验证：走查店/ }).first()).toBeVisible();
  await admin.context().close();
});

test("团队: home → 团队 → 邀请; the invited: home → 通知 → 接受 → 发布招聘 (#87)", async ({
  page,
  browser,
}, testInfo) => {
  await openShopAndPublish(page, testInfo, uniqueTitle("走查团队", testInfo));
  await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  await expect(page).toHaveURL("/");

  // The person to invite signs up first, from the home page of their own browser.
  const staff = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await staff.goto("/");
  const email = await signInByClicks(staff, testInfo, freshEmail("walk.staff"));

  await openMine(page, testInfo, "团队");
  await expect(page).toHaveURL("/employer/team");
  await page.getByLabel("对方的邮箱").fill(email);
  await page.getByRole("button", { name: "发送邀请" }).click();
  await expect(page.getByRole("status")).toContainText(`已邀请 ${email}`);

  await staff.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  await expect(staff).toHaveURL("/");
  await openMine(staff, testInfo, "通知");
  await staff
    .getByRole("main")
    .getByRole("link", { name: /邀请你加入团队/ })
    .click();
  await expect(staff).toHaveURL("/account#team-invites");
  const invite = staff.getByRole("form", { name: /的邀请$/ });
  await invite.getByLabel(/你在团队里的称呼/).fill("走查店员");
  await invite.getByRole("button", { name: "接受并加入" }).click();
  await expect(staff).toHaveURL("/employer/team");

  // The phone's employer bottom bar has 发布 as its raised middle button; the desktop header has 发布招聘.
  if (isPhone(testInfo)) await siteNav(staff).getByRole("link", { name: "发布", exact: true }).click();
  else await staff.getByRole("banner").getByRole("link", { name: "发布招聘" }).click();
  await expect(staff).toHaveURL("/employer/post");
  await openTheForm(staff);
  await staff.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await staff.getByRole("button", { name: "整理成职位" }).click();
  await staff.getByLabel("职位名称（中文）").fill(uniqueTitle("店员发的", testInfo));
  await staff.getByRole("button", { name: "预览", exact: true }).click();
  await staff.getByRole("button", { name: "发布", exact: true }).click();
  await expect(staff.getByRole("heading", { name: "已发布" })).toBeVisible();
  await staff.context().close();
});

test("审核后台和审核数据: a moderator signs in → 审核后台 → 审核数据 (#73)", async ({ page, browser }, testInfo) => {
  // A fresh account, made a moderator by the demo one (its code can be asked for once a minute, so it is not
  // signed in again here).
  const email = await signInByClicks(page, testInfo);
  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: "审核员" }).click();
  await admin.getByLabel("邮箱").fill(email);
  await admin.getByRole("button", { name: "添加", exact: true }).click();
  await expect(admin.getByRole("status")).toHaveText(`已处理：添加审核员 ${email}`);
  await admin.context().close();

  // Home by the logo in the header (on 我的 another link's name also holds 找工).
  await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  await expect(page).toHaveURL("/");
  if (isPhone(testInfo)) {
    await siteNav(page).getByRole("link", { name: "我的", exact: true }).click();
    await page
      .getByRole("main")
      .getByRole("link", { name: /^审核后台/ })
      .click();
  } else {
    await page
      .getByRole("banner")
      .getByRole("button", { name: /^账号菜单/ })
      .click();
    await page.locator("#account-menu").getByRole("link", { name: "审核后台" }).click();
  }
  await expect(page).toHaveURL("/admin");
  await page.getByRole("tab", { name: "审核数据" }).click();
  await expect(page.getByLabel("审核数据：现在")).toBeVisible();
});

test("外部职位: a moderator: home → 审核后台 → 外部职位 → 通过 / 不显示 (#112)", async ({ browser }, testInfo) => {
  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/");
  if (isPhone(testInfo)) {
    const mine = siteNav(admin).getByRole("link", { name: "我的", exact: true });
    await expect(mine).toHaveAttribute("href", "/account");
    await mine.click();
    await admin
      .getByRole("main")
      .getByRole("link", { name: /^审核后台/ })
      .click();
  } else {
    await admin
      .getByRole("banner")
      .getByRole("button", { name: /^账号菜单/ })
      .click();
    await admin.locator("#account-menu").getByRole("link", { name: "审核后台" }).click();
  }
  await expect(admin).toHaveURL("/admin");
  await admin.getByRole("tab", { name: /^外部职位/ }).click();
  await expect(admin.getByRole("heading", { name: /^待审核/ })).toBeVisible();

  // The demo data has two jobs waiting; each project takes its own, as both run on one server.
  const title = isPhone(testInfo) ? "Senior Electronics Engineer" : "Software Engineering Intern";
  const card = admin.getByRole("article", { name: `外部职位：${title}` });
  test.skip((await card.count()) === 0, "the demo job was already decided on this server (a second run)");
  await expect(card.getByRole("link", { name: "看官网原文" })).toHaveAttribute("target", "_blank");
  if (isPhone(testInfo)) {
    // Flagged (U.S. person): 通过 waits for the tick; this walk hides it instead, with a reason.
    await expect(card.getByRole("alert")).toContainText("U.S. person");
    await expect(card.getByRole("button", { name: "通过" })).toBeDisabled();
    await card.getByRole("button", { name: "不显示" }).click();
    await card.getByRole("radio", { name: "有按国籍、种族招人的要求" }).check();
    await card.getByRole("button", { name: "确定不显示" }).click();
    await expect(admin.getByRole("status")).toContainText(`不显示外部职位「${title}」`);
  } else {
    await card.getByRole("button", { name: "通过" }).click();
    await expect(admin.getByRole("status")).toHaveText(`已处理：通过外部职位「${title}」（Tūī Software）`);
    await expect(
      admin.getByRole("article", { name: `外部职位：${title}` }).getByText("正在显示", { exact: true }),
    ).toBeVisible();
  }
  await admin.context().close();
});

test("专业职位: home → 专业职位 → a job → 去官网申请 (#113)", async ({ page }) => {
  // The demo jobs link to example.com; answer it here instead of the network.
  await page.context().route("https://example.com/**", (route) => route.fulfill({ body: "company site" }));
  await page.goto("/");
  await page.getByRole("link", { name: "专业职位", exact: true }).first().click();
  await expect(page).toHaveURL("/professional");
  await page.getByRole("region", { name: "专业职位列表" }).getByRole("link", { name: "Full Stack Developer" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Full Stack Developer" })).toBeVisible();
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    page.getByRole("link", { name: "去官网申请（新窗口）" }).click(),
  ]);
  await expect(popup).toHaveURL(/example\.com\/demo-tui\/jobs\//);
  await popup.close();
});

test("中英文简历: home → 我的主页 → 生成简历 → 打印 / 存为 PDF and 生成分享链接 (#86)", async ({ page }, testInfo) => {
  await signInByClicks(page, testInfo, freshEmail("demo.walk")); // starts with 林晓's demo page (#125)
  await openMine(page, testInfo, "我的主页");
  await expect(page).toHaveURL("/profile");
  await page.getByRole("link", { name: "生成简历" }).click();
  await expect(page).toHaveURL("/profile/resume");
  await expect(page.getByRole("article", { name: "中英文简历" })).toBeVisible();
  await expect(page.getByRole("button", { name: "打印 / 存为 PDF" })).toBeVisible();
  await page.getByRole("link", { name: "去补填英文" }).click();
  await page.getByLabel("称呼（英文）").fill("Xiao Lin");
  await page.getByRole("button", { name: "生成分享链接" }).click();
  await expect(page.locator("#resume-share").getByRole("link", { name: /\/resume\// })).toBeVisible();
});

test("岗位类别（发帖）: home → 发布招聘 → 直接填表 → 岗位类别, preselected from the title → 发布 (#96)", async ({
  page,
}, testInfo) => {
  const run = `${isPhone(testInfo) ? "M" : "D"}${testInfo.workerIndex}${Date.now() % 1_000_000}`;
  await page.getByRole("banner").getByRole("link", { name: "发布招聘" }).click();
  await page.getByLabel("邮箱", { exact: true }).fill(`walk.roles.${run}@example.com`);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("radio", { name: /新建企业/ }).check();
  await page.getByLabel("店名", { exact: true }).fill(`类别走查店${run}`);
  await page.getByRole("combobox", { name: /^地区/ }).selectOption({ label: "市中心" });
  await page.getByRole("button", { name: "开通并开始发布招聘" }).click();
  await expect(page).toHaveURL("/employer/post");
  await openTheForm(page);
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await page.getByRole("button", { name: "整理成职位" }).click();
  await page.getByLabel("职位名称（中文）").fill(uniqueTitle("走查前台", testInfo));
  const roles = page.getByRole("group", { name: "岗位类别" });
  await expect(roles.getByLabel("前厅服务")).toBeChecked();
  await roles.getByLabel("收银", { exact: true }).check();
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已发布" })).toBeVisible();
});

test("想做的岗位: home → 我的主页 → 想做的岗位 (#96)", async ({ page }, testInfo) => {
  await signInByClicks(page, testInfo);
  await openMine(page, testInfo, "我的主页");
  await expect(page).toHaveURL("/profile");
  const roles = page.getByRole("group", { name: "想做的岗位" });
  await roles.getByLabel("前厅服务").check();
  await expect(roles.getByLabel("前厅服务")).toBeChecked();
});

test("按岗位类别筛选: home → 查看全部职位 → 岗位类别 → 前厅服务 (#96)", async ({ page }, testInfo) => {
  await toJobList(page);
  if (isPhone(testInfo)) await page.getByRole("button", { name: /^筛选/ }).click();
  await page.getByRole("button", { name: "岗位类别" }).click();
  await page.getByRole("group", { name: "岗位类别" }).getByText("前厅服务", { exact: true }).click();
  if (isPhone(testInfo)) await page.getByRole("button", { name: "查看职位" }).click();
  await expect(page).toHaveURL("/jobs?role=front_of_house");
  await expect(page.getByRole("link", { name: "去掉条件：前厅服务" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^前厅服务员/ }).first()).toBeVisible();
});

test("约面试: the employer 总览 → 1 个新申请 → 约面试; the job seeker 收藏和进度 → 我的申请 → 确认 (#103)", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000); // two people, each from the home page
  const { title, seeker } = await postAndApplyByClicks(page, browser, testInfo, "面试走查员");

  // The employer: home → 总览 → 「1 个新申请」 → 申请人 → 约面试, two days ahead at 10:00 Auckland time.
  await page.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  await openMine(page, testInfo, "总览");
  await page.getByRole("link", { name: /1 个新申请/ }).click();
  const applicant = page.getByRole("article", { name: /^申请人 / });
  await applicant.getByRole("button", { name: "约面试" }).click();
  const day = instantToAuckland(new Date(Date.now() + 2 * 86_400_000).toISOString()).slice(0, 10);
  await applicant.getByLabel("时间 1", { exact: true }).fill(`${day}T10:00`);
  await applicant.getByRole("button", { name: "发出邀约" }).click();
  await expect(applicant.getByRole("status", { name: /的面试$/ })).toContainText("已发邀约，等对方确认");

  // The job seeker: home → 收藏和进度 → 我的申请 → the time → 确认这个时间.
  await seeker.getByRole("dialog").getByRole("button", { name: "好的" }).click();
  await seeker.getByRole("banner").getByRole("link", { name: "找工", exact: true }).click();
  await openMine(seeker, testInfo, "收藏和进度");
  const invitation = seeker
    .getByRole("list", { name: "申请过的职位" })
    .getByRole("article", { name: title })
    .getByRole("region", { name: "面试邀约" });
  await invitation.getByRole("radio").first().check();
  await invitation.getByRole("button", { name: "确认这个时间" }).click();
  await expect(invitation).toContainText("面试已确认：");
  await expect(invitation.getByRole("button", { name: "下载日历文件（.ics）" })).toBeVisible();
  await seeker.context().close();
});
