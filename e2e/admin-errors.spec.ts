// #183: when a Server Function call on /admin gets no answer (no network, the server restarting), the card it was
// pressed in says 没成功，请重试 and keeps what the moderator had chosen and typed; a list that could not be loaded says
// so in its place, with 重试. The tests cut the network for /admin's Server Function calls (POSTs to /admin).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { moderatorPage, signUpEmployer } from "./employer/helpers";
import { waitForTitle } from "./helpers/title";

test.use({ reducedMotion: "reduce" });

/** Cuts /admin's Server Function calls while `cut.on` is true; the page itself and its scripts still load. */
async function cutCalls(admin: Page) {
  const cut = { on: false };
  await admin.route(
    (url) => url.pathname === "/admin",
    (route) => (cut.on && route.request().method() === "POST" ? route.abort("internetdisconnected") : route.fallback()),
  );
  return cut;
}

async function expectNoViolations(page: Page) {
  await waitForTitle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
}

/** An NZBN from the demo register's range 9429999xxxxxx that no other test run uses (as in verification.spec). */
function nzbnFor(testInfo: TestInfo): string {
  const digits = `${testInfo.project.name === "mobile" ? 3 : 4}${testInfo.workerIndex % 10}${Date.now() % 10_000}`;
  return `9429999${digits.padStart(6, "0").slice(-6)}`;
}

test("a rejection that gets no answer says 没成功，请重试 in its card and keeps the reason and the note", async ({
  page,
  browser,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/employer/verify");
  await page.getByLabel("公司名称或 NZBN").fill(nzbnFor(testInfo));
  await page.getByRole("button", { name: "查询" }).click();
  await page.getByRole("button", { name: "这是我的公司" }).click();
  await expect(page.getByRole("heading", { name: "2. 谁在申请" })).toBeFocused();
  await page.getByLabel(/联系人姓名/).fill("王店主");
  await page.getByLabel(/你在公司的职务/).fill("董事");
  await page.getByLabel(/^公司电话/).fill("09 000 0000");
  await page.getByRole("button", { name: "提交审核" }).click();
  await expect(page.getByRole("status")).toHaveText("已提交，审核员核对后会在通知里告诉你结果。");

  const admin = await moderatorPage(browser, testInfo);
  const cut = await cutCalls(admin);
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: /^企业验证/ }).click();
  const card = admin.getByRole("article", { name: `企业验证：${shop}` });
  // The checklist's links open a new window and say so (#293).
  await expect(card.getByRole("link", { name: "去查 NZBN 登记（新窗口）" })).toHaveAttribute("target", "_blank");
  await card.getByRole("checkbox", { name: "企业登记" }).check();
  await card.getByRole("button", { name: "驳回", exact: true }).click();
  const reason = card.getByRole("radio", { name: "电话核实不到人" });
  await reason.check();
  await card.getByLabel("说明").fill("公开的公司电话说没有这个人");

  cut.on = true;
  const confirm = card.getByRole("button", { name: "确定驳回" });
  await confirm.click();
  await expect(card.getByRole("alert")).toHaveText("没成功，请重试。");
  // The page is still there, and so is everything the moderator had done in the card.
  await expect(admin.getByRole("heading", { name: "审核后台" })).toBeVisible();
  await expect(reason).toBeChecked();
  await expect(card.getByLabel("说明")).toHaveValue("公开的公司电话说没有这个人");
  await expect(card.getByRole("checkbox", { name: "企业登记" })).toBeChecked();
  await expect(confirm).toBeEnabled();
  // #202: busy, the button kept the focus (Button loading is aria-disabled, not disabled); it still has it now.
  await expect(confirm).toBeFocused();
  await expectNoViolations(admin);

  cut.on = false;
  await confirm.click();
  await expect(admin.getByRole("status")).toContainText(`已处理：驳回企业验证「${shop}」 · 电话核实不到人`);
  await expect(card).toHaveCount(0);
  await admin.context().close();
});

test("lists that get no answer say so in their place, and 重试 asks again", async ({ browser }, testInfo) => {
  const admin = await moderatorPage(browser, testInfo);
  const cut = await cutCalls(admin);
  cut.on = true;
  await admin.goto("/admin");
  const queueFailed = admin.getByRole("alert").filter({ hasText: "审核队列没取到" });
  await expect(queueFailed).toBeVisible();
  await expect(admin.getByRole("alert").filter({ hasText: "审核数据没取到" })).toBeVisible();
  await admin.getByRole("tab", { name: /^外部职位/ }).click();
  await expect(admin.getByRole("alert").filter({ hasText: "外部职位没取到" })).toBeVisible();
  await expectNoViolations(admin);

  cut.on = false;
  await admin.getByRole("alert").filter({ hasText: "外部职位没取到" }).getByRole("button", { name: "重试" }).click();
  await expect(admin.getByRole("heading", { name: /^待审核 \d+$/ })).toBeVisible();
  // One 重试 asks for every list again: the summary and the first tab are back too.
  await expect(admin.getByLabel("审核数据：现在")).toBeVisible();
  await admin.getByRole("tab", { name: /^发布时被标记/ }).click();
  await expect(queueFailed).toHaveCount(0);
  await expect(admin.getByRole("tabpanel")).not.toContainText("没取到");
  await admin.context().close();
});
