// 雇主多人管理 (#87): an admin invites by email, the invited account accepts on 我的 with a name, and both work for
// the same business — its jobs, and one shared set of chats that says who sent each message.
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { freshEmail, signIn } from "../helpers";
import { publishJob, signUpEmployer, uniqueTitle } from "./helpers";

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

  // The member posts; the admin sees the job among the business's jobs.
  const title = uniqueTitle("团队发的职位", testInfo);
  await publishJob(staff.page, title);
  await page.goto("/employer/jobs");
  await expect(page.getByText(title).filter({ visible: true }).first()).toBeVisible();

  // The only admin cannot leave; after making the member an admin, they can.
  await page.goto("/employer/team");
  const me = page.getByRole("listitem", { name: "王老板，管理员" });
  await me.getByRole("button", { name: "退出团队" }).click();
  await me.getByRole("button", { name: "确认退出" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "团队里至少要有一位管理员：先把另一位成员设为管理员。",
  );
  await page.getByRole("listitem", { name: "小李，成员" }).getByRole("button", { name: "设为管理员" }).click();
  await expect(page.getByRole("listitem", { name: "小李，管理员" })).toBeVisible();
  await me.getByRole("button", { name: "退出团队" }).click();
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
