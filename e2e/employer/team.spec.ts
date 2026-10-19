// 雇主多人管理 (#87): an admin invites by email, the invited account accepts on 我的 with a name, and both work for
// the same business — its jobs, and one shared set of chats that says who sent each message.
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { freshEmail, signIn } from "../helpers";
import {
  cardMenuItem,
  CLEAN_MESSAGE,
  openTheForm,
  publishFromPreview,
  publishJob,
  signUpEmployer,
  uniqueTitle,
} from "./helpers";

/** A second browser with a fresh account signed in, on 我的. Close it with `page.context().close()`. */
async function secondPerson(browser: Browser, testInfo: TestInfo): Promise<{ page: Page; email: string }> {
  const context = await browser.newContext({ ...testInfo.project.use });
  const page = await context.newPage();
  const email = await signIn(page, "/account", freshEmail("demo.e2e.team"));
  return { page, email };
}

/** On /employer/team: saves the signed-in person's name. */
async function saveName(page: Page, name: string) {
  await page.getByLabel(/^称呼/).fill(name);
  await page.getByRole("button", { name: "保存称呼" }).click();
  await expect(page.getByRole("status")).toHaveText("称呼已保存。");
}

/** The admin (on /employer/team) invites `staff`, who accepts on 我的 as 小李 and lands on the team page. */
async function invitedAndJoined(admin: Page, staff: { page: Page; email: string }, shop: string) {
  await admin.getByLabel("对方的邮箱").fill(staff.email);
  await admin.getByRole("button", { name: "发送邀请" }).click();
  await expect(admin.getByRole("status")).toContainText(`已邀请 ${staff.email}`);
  await expect(admin.getByRole("region", { name: "等对方回复" })).toContainText(staff.email);

  await staff.page.reload();
  const invite = staff.page.getByRole("form", { name: `${shop} 的邀请` });
  await expect(invite).toContainText("邀请你加入团队，做成员");
  await invite.getByLabel(/你在团队里的称呼/).fill("小李");
  await invite.getByRole("button", { name: "接受并加入" }).click();
  await expect(staff.page).toHaveURL("/employer/team");
  await expect(staff.page.getByRole("listitem", { name: "小李，成员" })).toBeVisible();
}

test("an admin invites a teammate, who accepts on 我的 and posts for the business; only admins run the team", async ({
  page,
  browser,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/employer/team");
  await expect(page.getByRole("listitem", { name: /，管理员$/ })).toContainText("（你）");
  await saveName(page, "王老板");
  const staff = await secondPerson(browser, testInfo);
  await invitedAndJoined(page, staff, shop);
  await expect(staff.page.getByRole("listitem", { name: "王老板，管理员" })).toBeVisible();
  // A member neither invites nor changes anyone, and 企业验证 is for admins.
  await expect(staff.page.getByRole("button", { name: "发送邀请" })).toHaveCount(0);
  await expect(staff.page.getByRole("button", { name: "设为管理员" })).toHaveCount(0);
  await staff.page.goto("/employer/verify");
  await expect(staff.page.getByText("只有团队管理员能申请企业验证").filter({ visible: true })).toBeVisible();
  await expect(staff.page.getByRole("button", { name: "查询" })).toHaveCount(0);

  // The member posts; the admin sees the job among the business's jobs, and who posted it (#182).
  const title = uniqueTitle("团队发的职位", testInfo);
  await publishJob(staff.page, title);
  await page.goto("/employer/jobs");
  await expect(page.getByText(title).filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: title })).toContainText("小李发布");

  // The only admin cannot leave or step down (#296: not offered, and the row says why); after making the member an
  // admin, they can.
  await page.goto("/employer/team");
  const me = page.getByRole("listitem", { name: "王老板，管理员" });
  await expect(me).toContainText("团队里至少要有一位管理员：先把另一位成员设为管理员。");
  await expect(me.getByRole("button", { name: "退出团队" })).toHaveCount(0);
  await expect(me.getByRole("button", { name: "改为成员" })).toHaveCount(0);
  await page.getByRole("listitem", { name: "小李，成员" }).getByRole("button", { name: "设为管理员" }).click();
  await expect(page.getByRole("listitem", { name: "小李，管理员" })).toBeVisible();
  // #248: 确认退出 takes the place of 退出团队 and the focus; 取消 gives it back.
  const leave = me.getByRole("button", { name: "退出团队" });
  await leave.click();
  await expect(me.getByRole("button", { name: "确认退出" })).toBeFocused();
  await me.getByRole("button", { name: "取消", exact: true }).click();
  await expect(leave).toBeFocused();
  await leave.click();
  await page.getByRole("listitem", { name: "王老板，管理员" }).getByRole("button", { name: "确认退出" }).click();
  await expect(page).toHaveURL("/account");
  await staff.page.goto("/employer/team");
  await expect(staff.page.getByRole("heading", { name: "成员（1）" })).toBeVisible();
  await staff.page.context().close();
});

test("the team shares the business's chats, and each message says who sent it", async ({ page, browser }, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/employer/team", { demo: true });
  await saveName(page, "王老板");
  const staff = await secondPerson(browser, testInfo);
  await invitedAndJoined(page, staff, shop);

  const send = async (who: Page, text: string) => {
    await who.goto("/messages?conversation=candidate-lin");
    await who.getByLabel("输入消息").fill(text);
    await who.getByRole("button", { name: "发送", exact: true }).click();
    await expect(who.getByRole("log").getByText(text)).toBeVisible();
  };
  await send(page, "老板先回一句");
  await send(staff.page, "店员接着回复");
  const log = staff.page.getByRole("log");
  await expect(log.getByText("老板先回一句")).toBeVisible();
  await expect(log.locator("[data-message-by]")).toHaveText(["王老板", "小李"]);
  // The admin sees the member's message too, after a reload (the record is the business's, on the server).
  await page.reload();
  await expect(page.getByRole("log").locator("[data-message-by]")).toHaveText(["王老板", "小李"]);
  await staff.page.context().close();
});

test("the 企业主页 is the business's: visitors and the team see what an admin saved; a member reads it (#181)", async ({
  page,
  browser,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/employer/team");
  await saveName(page, "王老板");
  const staff = await secondPerson(browser, testInfo);
  await invitedAndJoined(page, staff, shop);

  await page.goto("/profile");
  const bio = `团队一起维护的企业介绍 ${testInfo.project.name}`;
  await page.getByLabel("企业介绍", { exact: true }).fill(bio);
  await expect(page.getByText(/^已保存到企业主页/)).toBeVisible();
  const publicUrl = await page.getByRole("link", { name: "查看公开主页", exact: true }).getAttribute("href");

  // A member sees the saved page, read-only, and is told who can change it.
  await staff.page.goto("/profile");
  await expect(staff.page.getByText("企业主页只有管理员（王老板）能改", { exact: false })).toBeVisible();
  const field = staff.page.getByLabel("企业介绍", { exact: true });
  await expect(field).toHaveValue(bio);
  await expect(field).toBeDisabled();
  await staff.page.context().close();

  // Someone who is not signed in, in another browser, sees it on the public page.
  const visitor = await browser.newContext({ ...testInfo.project.use });
  const guest = await visitor.newPage();
  await guest.goto(publicUrl!);
  await expect(guest.getByRole("heading", { name: shop, exact: true })).toBeVisible();
  await expect(guest.getByRole("region", { name: "企业介绍", exact: true })).toContainText(bio);
  await visitor.close();
});

test("a job showing the contact details of someone who left asks the team to change them (#186)", async ({
  page,
  browser,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/employer/team");
  const staff = await secondPerson(browser, testInfo);
  await invitedAndJoined(page, staff, shop);

  // The member posts a job with public contact details, then leaves the team.
  const title = uniqueTitle("离职前发的职位", testInfo);
  await staff.page.goto("/employer/post");
  await openTheForm(staff.page);
  await staff.page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await staff.page.getByRole("button", { name: "整理成职位" }).click();
  await staff.page.getByLabel("职位名称（中文）").fill(title);
  await staff.page.getByRole("radio", { name: /^公开给登录的求职者/ }).check();
  await staff.page.getByLabel("电话").fill("09 055 0197");
  await staff.page.getByRole("button", { name: "预览", exact: true }).click();
  await publishFromPreview(staff.page);
  await staff.page.goto("/employer/team");
  const me = staff.page.getByRole("listitem", { name: "小李，成员" });
  await me.getByRole("button", { name: "退出团队" }).click();
  await me.getByRole("button", { name: "确认退出" }).click();
  await expect(staff.page).toHaveURL("/account");
  await staff.page.context().close();

  await page.goto("/employer/jobs");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card).toContainText("联系方式是已离开团队的");
  await (await cardMenuItem(card, "编辑")).click();
  await expect(page.getByRole("heading", { name: "编辑职位" })).toBeVisible();
  await page.getByLabel("电话").fill("09 055 0196");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存").filter({ visible: true })).toBeVisible();
  await page.goto("/employer/jobs");
  await expect(card).toBeVisible();
  await expect(card).not.toContainText("联系方式是已离开团队的");
});

test("the 企业主页 refuses what cannot be public, such as a WeChat ID, and saves once it is gone (#195)", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  await page.goto("/profile");
  const bio = page.getByLabel("企业介绍", { exact: true });
  await bio.fill("欢迎加入，加微信 shop_wx_2026 了解详情");
  const refused = page.getByRole("main").getByRole("alert").filter({ hasText: "企业主页没保存" });
  await expect(refused).toContainText("企业介绍写了联系方式");
  await expect(page.getByText(/^没保存：企业主页里有不能公开的内容/)).toBeVisible();
  await bio.fill("欢迎加入，想了解职位请在职位页上联系我们。");
  await expect(page.getByText(/^已保存到企业主页/)).toBeVisible();
  await expect(refused).toHaveCount(0);
});
