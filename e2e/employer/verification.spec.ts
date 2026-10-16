import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { moderatorPage, signUpEmployer } from "./helpers";

// 企业验证 by a person (#78, PRD R-16): the employer applies, a moderator works through the checklist and approves
// or rejects with a reason. Each test applies with an NZBN of its own from the demo register's range 9429999xxxxxx.

function nzbnFor(testInfo: TestInfo): string {
  const digits = `${testInfo.project.name === "mobile" ? 1 : 2}${testInfo.workerIndex % 10}${Date.now() % 10_000}`;
  return `9429999${digits.padStart(6, "0").slice(-6)}`;
}

/** On /employer/verify: find the company by NZBN, choose it and apply. */
async function apply(page: Page, nzbn: string, phone = "09 555 0123") {
  await page.getByLabel("公司名称或 NZBN").fill(nzbn);
  await page.getByRole("button", { name: "查询" }).click();
  await page.getByRole("button", { name: "这是我的公司" }).click();
  await expect(page.getByRole("heading", { name: "2. 谁在申请" })).toBeFocused();
  await page.getByLabel(/联系人姓名/).fill("王店主");
  await page.getByLabel(/你在公司的职务/).fill("董事");
  await page.getByLabel(/^公司电话/).fill(phone);
  await page.getByRole("button", { name: "提交审核" }).click();
  await expect(page.getByRole("status")).toHaveText("已提交，审核员核对后会在通知里告诉你结果。");
}

/** The moderator's card for the shop on the 企业验证 tab of /admin. */
async function cardFor(admin: Page, shop: string) {
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: /^企业验证/ }).click();
  return admin.getByRole("article", { name: `企业验证：${shop}` });
}

test("an application waits for a moderator, who approves it after the checklist; the badge changes then", async ({
  page,
  browser,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/employer/verify");
  const nzbn = nzbnFor(testInfo);
  await apply(page, nzbn);
  const latest = page.getByRole("region", { name: "验证申请" });
  await expect(latest).toContainText("验证审核中");
  await expect(latest).toContainText(`NZBN ${nzbn}`);
  await expect(page.getByRole("main")).toContainText("现在是 未验证");
  await page.screenshot({ path: testInfo.outputPath("pending.png"), fullPage: true });

  const admin = await moderatorPage(browser, testInfo);
  const card = await cardFor(admin, shop);
  await expect(card).toContainText(`Demo Company ${nzbn.slice(-6)} Limited`);
  const approve = card.getByRole("button", { name: "通过", exact: true });
  await expect(approve).toBeDisabled();
  await card.getByRole("checkbox", { name: "企业登记" }).check();
  await card.getByRole("checkbox", { name: "申请人身份" }).check();
  await card.getByLabel("申请人身份的备注").fill("董事名单上有王店主");
  await expect(approve).toBeDisabled(); // the phone call is still to do
  await card.getByRole("checkbox", { name: "电话核实" }).check();
  expect(
    (await new AxeBuilder({ page: admin }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations,
  ).toEqual([]);
  await admin.screenshot({ path: testInfo.outputPath("admin-checklist.png"), fullPage: true });
  await approve.click();
  await expect(admin.getByRole("status")).toContainText(`已处理：通过企业验证「${shop}」`);
  await expect(card).toHaveCount(0);
  await admin.context().close();

  await page.reload();
  await expect(page.getByRole("region", { name: "验证申请" })).toContainText("已通过：已验证企业");
  await page.goto("/notifications");
  await expect(page.getByRole("region", { name: "通知列表" })).toContainText("企业验证已通过：已验证企业");
});

test("a rejection reaches the employer with its reason, who corrects the details and applies again", async ({
  page,
  browser,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/employer/verify");
  const nzbn = nzbnFor(testInfo);
  await apply(page, nzbn, "021 000 0000");

  const admin = await moderatorPage(browser, testInfo);
  const card = await cardFor(admin, shop);
  await card.getByRole("button", { name: "驳回", exact: true }).click();
  const confirm = card.getByRole("button", { name: "确定驳回" });
  await expect(confirm).toBeDisabled(); // a reason and a note first
  await card.getByRole("radio", { name: "电话核实不到人" }).check();
  await card.getByLabel("说明").fill("公开的公司电话说没有这个人");
  await confirm.click();
  await expect(admin.getByRole("status")).toContainText(`已处理：驳回企业验证「${shop}」 · 电话核实不到人`);
  await admin.context().close();

  await page.goto("/workspace");
  await page.getByRole("link", { name: /企业验证没有通过/ }).click();
  await expect(page).toHaveURL("/employer/verify");
  const latest = page.getByRole("region", { name: "验证申请" });
  await expect(latest).toContainText("上次申请没有通过");
  await expect(latest).toContainText("电话核实不到人：公开的公司电话说没有这个人");

  // The form starts with what was sent; correct the phone and apply again.
  await expect(page.getByRole("heading", { name: "改好资料，重新提交" })).toBeVisible();
  await expect(page.getByLabel("公司名称或 NZBN")).toHaveValue(nzbn);
  await page.getByRole("button", { name: "查询" }).click();
  await page.getByRole("button", { name: "这是我的公司" }).click();
  await expect(page.getByLabel(/联系人姓名/)).toHaveValue("王店主");
  await page.getByLabel(/^公司电话/).fill("09 555 0456");
  await page.getByRole("button", { name: "提交审核" }).click();
  await expect(latest).toContainText("验证审核中");
  await expect(latest).toContainText("09 555 0456");
});
