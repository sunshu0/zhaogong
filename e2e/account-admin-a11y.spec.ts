import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fillSignInCode, freshEmail, signIn } from "./helpers";
import { moderatorPage } from "./employer/helpers";

// #187: axe on line C's pages that no spec scanned yet, in the states people see: each step of /login, 我的 and
// 数据与账号, and the 外部职位 tab of /admin (the other tabs are in employer/a11y.spec). WCAG 2.1 A and AA, no
// exceptions, at 375 px and 1280 px (the two projects). Nothing here is submitted that changes data for other specs.

// Round 19 cards pop in and fade: axe scans the settled page, as with "reduce motion".
test.use({ reducedMotion: "reduce" });

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

test("/login, every step: email, a mistyped domain, the code with its countdown, the employer's business", async ({
  page,
}) => {
  await page.goto("/login");
  const field = page.getByLabel("邮箱", { exact: true });
  await expect(field).toBeVisible();
  await expectNoViolations(page, "/login email step");

  const name = freshEmail("a11y.login").split("@")[0];
  await field.fill(`${name}@gmial.com`);
  await field.blur();
  await expect(page.getByRole("button", { name: `改成 ${name}@gmail.com` })).toBeVisible();
  await expectNoViolations(page, "/login with the mistyped-domain hint");

  await page.getByRole("button", { name: `改成 ${name}@gmail.com` }).click();
  await page.getByRole("radio", { name: /我要招人/ }).check();
  await page.getByRole("button", { name: "获取验证码" }).click();
  await expect(page.getByRole("button", { name: /秒后可重新获取$/ })).toBeDisabled();
  await expectNoViolations(page, "/login code step, counting down");

  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "开通雇主身份" })).toBeVisible();
  await expectNoViolations(page, "/login business step");
  await page.getByRole("radio", { name: /新建企业/ }).check();
  await page.getByRole("button", { name: /^地区/ }).click();
  await expect(page.getByRole("listbox", { name: "地区", exact: true })).toBeVisible();
  await expectNoViolations(page, "/login business step, 新建企业 with 地区 open");
});

test("我的 and 数据与账号, before and after the delete confirmation is typed", async ({ page }) => {
  const email = await signIn(page, "/account", freshEmail("a11y.account"));
  await expect(page.getByRole("link", { name: /数据与账号/ }).first()).toBeVisible();
  await expectNoViolations(page, "/account");

  await page.goto("/account/data");
  const confirm = page.getByLabel(/输入你的登录邮箱/);
  await expect(confirm).toBeVisible();
  await expectNoViolations(page, "/account/data");
  await confirm.fill(email);
  await expect(page.getByRole("button", { name: "永久删除账号" })).toBeEnabled();
  await expectNoViolations(page, "/account/data, delete ready (not pressed)");
});

test("审核后台 · 外部职位: the lists, a flagged job's tick, the 不显示 and 停用 forms open", async ({
  browser,
}, testInfo) => {
  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await admin.getByRole("tab", { name: /^外部职位/ }).click();
  await expect(admin.getByRole("heading", { name: /^待审核 \d+$/ })).toBeVisible();
  await expectNoViolations(admin, "/admin 外部职位");

  // The demo data has a flagged job waiting, unless another spec on this server has decided it already.
  const flagged = admin.getByRole("article", { name: /^外部职位：/ }).filter({ has: admin.getByRole("alert") });
  if ((await flagged.count()) > 0) {
    await flagged.first().getByRole("checkbox").check();
    await expectNoViolations(admin, "/admin 外部职位, a flagged job ticked");
    await flagged.first().getByRole("checkbox").uncheck();
  }

  const job = admin.getByRole("article", { name: /^外部职位：/ }).first();
  if ((await job.count()) > 0) {
    await job.getByRole("button", { name: /^(不显示|撤下，不再显示)$/ }).click();
    await expect(job.getByRole("group", { name: "不显示的理由" })).toBeVisible();
    await expectNoViolations(admin, "/admin 外部职位, 不显示 form open");
    await job.getByRole("button", { name: "取消" }).click();
  }

  const company = admin.getByRole("article", { name: /^外部公司：/ }).first();
  await company.getByRole("button", { name: /^(停用|恢复导入)$/ }).click();
  await expect(company.getByRole("group")).toBeVisible();
  await expectNoViolations(admin, "/admin 外部职位, a company's form open");
  await company.getByRole("button", { name: "取消" }).click();
  await admin.context().close();
});
