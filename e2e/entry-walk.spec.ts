import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { fillSignInCode, freshEmail, siteNav } from "./helpers";
import { CLEAN_MESSAGE, openReportForm, openTheForm, uniqueTitle } from "./employer/helpers";

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
  test.fixme(!isPhone(testInfo), "#76: on a desktop neither the account menu nor the workspace sidebar links to it.");
  const email = await signInByClicks(page, testInfo);
  await openMine(page, testInfo, "数据与账号");
  await expect(page).toHaveURL("/account/data");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载我的数据" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.json$/);

  await page.getByLabel(/输入你的登录邮箱/).fill(email);
  await page.getByRole("button", { name: "永久删除账号" }).click();
  await expect(page.getByText("账号已删除")).toBeVisible();
});

test("雇主职位数据: home → 发布招聘 → publish → 职位管理 → 近 14 天", async ({ page }, testInfo) => {
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

  const title = uniqueTitle("走查服务员", testInfo);
  await openTheForm(page);
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await page.getByRole("button", { name: "整理成职位" }).click();
  await page.getByLabel("职位名称（中文）").fill(title);
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已发布" })).toBeVisible();

  // The bottom bar is hidden while posting (hidesBottomNav); the 已发布 screen links to 职位管理 itself.
  await page.getByRole("main").getByRole("link", { name: "职位管理", exact: true }).click();
  await expect(page).toHaveURL("/employer/jobs");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card).toContainText("次浏览");
  await card.getByRole("link", { name: "近 14 天" }).click();
  await expect(page).toHaveURL(/\/employer\/jobs\/j\d+\/stats$/);
  await expect(page.getByRole("heading", { name: "职位数据" })).toBeVisible();
});

test("职位续期: 职位管理 → 快到期的职位 → 续期 (#69)", async () => {
  test.fixme(true, "#69 (职位快到期提醒、续期和重新发布) is not merged yet; walk it once it is.");
});

test("审核后台和审核数据: a moderator signs in → 审核后台 → 审核数据 (#73)", async () => {
  test.fixme(true, "#73: no link anywhere leads to /admin yet; walk it once A's #73 is merged.");
});
