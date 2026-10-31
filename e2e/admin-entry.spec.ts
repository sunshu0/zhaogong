// #73, ADR 0043: a moderator's account is for moderating only. It lands on 审核后台, is offered 审核后台 and 我的
// only, and is sent there from any other page; public pages stay. Only an admin adds and removes moderators. The
// server decides who is staff; the page follows on its next load.
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { siteNav, signIn } from "./helpers";
import { adminPage, moderatorPage, openAdminTab } from "./employer/helpers";

const isPhone = (testInfo: TestInfo) => testInfo.project.name !== "desktop";

/** Whether the page is a staff account's: 审核后台 in the navigation, and nothing to find work with. */
async function looksLikeStaff(page: Page, testInfo: TestInfo) {
  await expect(siteNav(page).getByRole("link", { name: "审核后台", exact: true })).toBeVisible();
  await expect(siteNav(page).getByRole("link", { name: /^(职位|找工作|聊天)$/ })).toHaveCount(0);
  if (isPhone(testInfo)) await expect(siteNav(page).getByRole("link", { name: "我的", exact: true })).toBeVisible();
  else await expect(page.getByRole("banner").getByRole("link", { name: "发布招聘" })).toHaveCount(0);
}

test("the demo moderator lands on 审核后台 from any page, and keeps only 我的 and the public pages", async ({
  browser,
}, testInfo) => {
  const moderator = await moderatorPage(browser, testInfo);
  for (const away of ["/", "/jobs", "/me", "/employer/post", "/account/data"]) {
    await moderator.goto(away);
    await expect(moderator).toHaveURL("/admin");
  }
  await expect(moderator.getByRole("tab", { name: /^发布时被标记/ })).toBeVisible();
  await looksLikeStaff(moderator, testInfo);

  // 我的: who they are, 审核后台, the language and 退出登录; nothing of a job seeker's.
  await moderator.goto("/account");
  const main = moderator.getByRole("main");
  await expect(main.getByText("当前身份：审核员")).toBeVisible();
  await expect(main.getByRole("link", { name: /^审核后台/ })).toBeVisible();
  for (const other of [/^工作台/, /^收藏/, /^数据与账号/, /开通雇主身份/])
    await expect(main.getByRole("link", { name: other })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "退出登录" })).toBeVisible();

  if (!isPhone(testInfo)) {
    await moderator
      .getByRole("banner")
      .getByRole("button", { name: /^账号菜单/ })
      .click();
    const menu = moderator.locator("#account-menu");
    await expect(menu.getByRole("link")).toHaveText(["审核后台"]);
    await menu.getByRole("link", { name: "审核后台" }).click();
    await expect(moderator).toHaveURL("/admin");
  }

  // The public pages stay.
  await moderator.goto("/safety");
  await expect(moderator).toHaveURL("/safety");
  await moderator.context().close();
});

test("an admin makes a clean account a moderator and takes it back; only an admin can (ADR 0043)", async ({
  page,
  browser,
}, testInfo) => {
  // A fresh account signed in from /admin's own sign-in link: refused, and a job seeker as before.
  const email = await signIn(page, "/admin");
  await expect(page.getByText("只有审核员能使用审核后台。", { exact: true })).toBeVisible();
  await page.goto("/jobs");
  await expect(page).toHaveURL("/jobs");

  // A moderator who is not an admin sees the list only.
  const moderator = await moderatorPage(browser, testInfo);
  await moderator.goto("/admin");
  await openAdminTab(moderator, "审核员");
  await expect(moderator.getByText("只有管理员能添加、移除审核员，这里只能查看名单。")).toBeVisible();
  await expect(moderator.getByRole("button", { name: "添加", exact: true })).toHaveCount(0);
  await expect(moderator.getByRole("button", { name: /^移除审核员/ })).toHaveCount(0);
  await expect(moderator.getByRole("tab", { name: "审核员变动记录" })).toHaveCount(0);
  await moderator.context().close();

  const admin = await adminPage(browser, testInfo);
  await admin.goto("/admin");
  await openAdminTab(admin, "审核员");
  await admin.getByLabel("邮箱").fill(email);
  await admin.getByRole("button", { name: "添加", exact: true }).click();
  await expect(admin.getByRole("status")).toHaveText(`已处理：添加审核员 ${email}`);

  // On its next page load the account is a moderator's: any page leads to 审核后台.
  await page.goto("/jobs");
  await expect(page).toHaveURL("/admin");
  await looksLikeStaff(page, testInfo);

  await admin.getByRole("button", { name: `移除审核员 ${email}` }).click();
  await admin.getByRole("button", { name: "确认移除" }).click();
  await expect(admin.getByRole("status")).toHaveText(`已处理：移除审核员 ${email}`);
  await admin.getByRole("tab", { name: "审核员变动记录" }).click();
  const record = admin.getByRole("listitem").filter({ hasText: email });
  await expect(record.first()).toContainText(`移除审核员 ${email}`);
  await expect(record.first()).toContainText("操作人：admin@example.com");
  await admin.context().close();

  // And back to a job seeker.
  await page.goto("/jobs");
  await expect(page).toHaveURL("/jobs");
  await expect(siteNav(page).getByRole("link", { name: "审核后台", exact: true })).toHaveCount(0);
});

test("an account with a job seeker's data cannot be made a moderator (ADR 0043)", async ({
  page,
  browser,
}, testInfo) => {
  const email = await signIn(page, "/jobs/j3");
  const save = page.getByRole("button", { name: "收藏：点心师傅" }).filter({ visible: true });
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(save).not.toHaveAttribute("aria-busy");

  const admin = await adminPage(browser, testInfo);
  await admin.goto("/admin");
  await openAdminTab(admin, "审核员");
  await admin.getByLabel("邮箱").fill(email);
  await admin.getByRole("button", { name: "添加", exact: true }).click();
  await expect(admin.getByRole("status")).toHaveText("这个邮箱已经有求职或招聘的数据。请用一个专门的审核员邮箱。");
  await admin.context().close();
});
