import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { chatMenuItem, exchangeTool, signIn } from "./helpers";
import { signUpEmployer } from "./employer/helpers";

test("the side that asks offers first: the other side sees its details at once, and gives its own only by agreeing", async ({
  page,
}, testInfo) => {
  await signIn(page, "/profile", `consent.${testInfo.project.name}.${Date.now()}@example.com`);
  await page.getByLabel("交换用电话", { exact: true }).fill("021 555 8801");
  await page.getByLabel("交换用微信", { exact: true }).fill("private_seeker_wechat");
  await expect(page.getByLabel("交换用地址", { exact: true })).toHaveCount(0); // A24: no address exchange
  await page.goto("/messages?conversation=north-tea");
  // The employer asked, so its details are already here; mine are not.
  const contact = page.getByRole("region", { name: "联系方式交换请求", exact: true });
  await expect(contact).toContainText("对方已先提供自己的资料");
  await expect(contact).toContainText("021 555 0901");
  await expect(contact).not.toContainText("021 555 8801");
  await contact.getByRole("button", { name: "查看并同意", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("021 555 8801");
  await expect(dialog).not.toContainText("021 555 0901");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(contact.getByRole("button", { name: "查看并同意", exact: true })).toBeFocused();
  await expect(contact).not.toContainText("private_seeker_wechat");
  await contact.getByRole("button", { name: "查看并同意", exact: true }).click();
  await dialog.getByRole("button", { name: "同意并交换双方资料", exact: true }).click();
  await expect(contact).toContainText("双方已同意");
  await expect(contact).toContainText("021 555 0901");
  await expect(contact).toContainText("private_seeker_wechat");
  await page.reload();
  await expect(contact).toContainText("双方已同意");
  await expect(page.getByRole("button", { name: "交换地址" })).toHaveCount(0);

  // I ask for the résumé / business details: mine go with the request, theirs come only if they agree.
  await (await exchangeTool(page, "交换资料")).click();
  await expect(dialog).toContainText("发出请求时给对方的资料");
  await dialog.getByRole("button", { name: "发送交换请求", exact: true }).click();
  const outgoing = page.getByRole("region", { name: "简历与企业资料交换请求", exact: true });
  await expect(outgoing).toContainText("你已提供自己的资料，对方现在能看到");
  await expect(outgoing.getByRole("heading", { name: "我提供的资料" })).toBeVisible();
  await expect(outgoing.getByRole("heading", { name: "对方的资料" })).toHaveCount(0);
  await expect(outgoing.getByRole("button", { name: "查看并同意", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(outgoing).toContainText("等待对方同意");
  await outgoing.getByRole("button", { name: "撤回请求", exact: true }).click();
  await expect(outgoing).toContainText("请求已撤回，对方不再看到你的资料");
  await expect(outgoing.getByRole("heading", { name: "我提供的资料" })).toHaveCount(0);

  // Refusing a request gives nothing back, and its details are no longer shown.
  await page.goto("/messages?conversation=mt-eden");
  const resume = page.getByRole("region", { name: "简历与企业资料交换请求", exact: true });
  await expect(resume).toContainText("餐饮门店，招聘前厅与厨房同事");
  await resume.getByRole("button", { name: "拒绝交换", exact: true }).click();
  await expect(resume).toContainText("你已拒绝，你的资料没有给对方");
  await expect(resume).not.toContainText("餐饮门店，招聘前厅与厨房同事");
  await page.reload();
  await expect(resume).toContainText("你已拒绝");
  await page.screenshot({ path: testInfo.outputPath("exchange-refused.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto("/messages?conversation=clean-home");
  await (await chatMenuItem(page, "举报")).click();
  await dialog.getByRole("button", { name: "提交举报", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("请选择举报原因");
  await dialog.getByLabel("举报原因", { exact: true }).selectOption("privacy");
  await dialog.getByLabel("补充说明（选填）", { exact: true }).fill("对方在未经同意时要求获取其他资料。");
  await dialog.getByRole("button", { name: "提交举报", exact: true }).click();
  await expect(dialog).toContainText("举报已记录");
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await page.reload();
  await (await chatMenuItem(page, "举报")).click();
  await expect(dialog).toContainText("本机举报记录（1）");
  await dialog.getByRole("button", { name: "关闭弹窗", exact: true }).click();
});

test("asking first needs your own details: without them the request cannot be sent", async ({ page }, testInfo) => {
  await signIn(
    page,
    "/messages?conversation=clean-home",
    `consent.empty.${testInfo.project.name}.${Date.now()}@example.com`,
  );
  await (await exchangeTool(page, "交换联系方式")).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("你还没有填写联系方式。先填好自己的，才能发起交换。");
  await expect(dialog.getByRole("button", { name: "发送交换请求", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("link", { name: "去主页填写联系方式", exact: true })).toHaveAttribute(
    "href",
    "/profile",
  );
});

test("employers can report seekers and accepted private data stays out of public pages and the other identity", async ({
  page,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/profile");
  await page.getByLabel("企业介绍", { exact: true }).fill("餐饮企业的公开招聘介绍");
  await page.getByLabel("交换用电话", { exact: true }).fill("021 555 8802");
  await page.getByRole("link", { name: "查看公开主页", exact: true }).click();
  await expect(page).toHaveURL(/\/employers\//);
  await expect(page.getByRole("main")).not.toContainText("021 555 8802");
  await page.goto("/messages?conversation=candidate-lin");
  const contact = page.getByRole("region", { name: "联系方式交换请求", exact: true });
  await contact.getByRole("button", { name: "查看并同意", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "同意并交换双方资料", exact: true }).click();
  await expect(contact).toContainText("021 555 8802");
  await (await chatMenuItem(page, "举报")).click();
  await expect(dialog).toContainText("林晓 · 求职者");
  await dialog.getByLabel("举报原因", { exact: true }).selectOption("other");
  await dialog.getByRole("button", { name: "提交举报", exact: true }).click();
  await expect(dialog.getByRole("alert")).toHaveText("请补充说明具体问题");
  await dialog.getByLabel("举报原因", { exact: true }).selectOption("harassment");
  await dialog.getByLabel("举报范围", { exact: true }).selectOption("1");
  await page.screenshot({ path: testInfo.outputPath("report-dialog.png"), fullPage: true });
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  await dialog.getByRole("button", { name: "提交举报", exact: true }).click();
  await expect(dialog).toContainText("举报已记录");
  const report = await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem("zhaogong:session")!);
    const scope = JSON.stringify([session.email, "employer", session.employerId]);
    return JSON.parse(localStorage.getItem("zhaogong:chat-demo")!).identities[scope].reports[0];
  });
  expect(report.targetRole).toBe("seeker");
  expect(report.evidence).toHaveLength(1);
  expect(report.evidence[0].from).toBe("them");
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await page.goto("/messages?conversation=north-tea");
  await expect(page.getByRole("log")).not.toContainText("021 555 8802");
  await expect(page.getByRole("region", { name: "联系方式交换请求", exact: true })).toContainText(
    "对方已先提供自己的资料",
  );
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: `切换为雇主（${shop}）`, exact: true }).click();
  await page.goto("/messages?conversation=candidate-lin");
  await expect(contact).toContainText("双方已同意");
});
