// The confirming steps of visual-2 (UI reviews 1 B and 3, rework 6 and 13): an action that throws something away asks
// in its own place first; 取消 brings the focus back to the button that asked, and the business step's errors take
// the focus to the box to fix.
import { expect, test } from "@playwright/test";
import { fillSignInCode, freshEmail } from "../helpers";
import {
  moderatorPage,
  openAdminTab,
  openReportForm,
  openTheForm,
  publishJob,
  signUpEmployer,
  uniqueTitle,
} from "./helpers";

/** A 1×1 PNG, as company-photos.spec.ts uploads. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("the business step sends the focus to the name, then to the area (rework 6)", async ({ page }) => {
  await page.goto("/login?role=employer&next=%2Femployer%2Fpost");
  await page.getByLabel("邮箱", { exact: true }).fill(freshEmail("e2e.b.confirm"));
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "开通雇主身份" })).toBeVisible();
  await page.getByRole("radio", { name: /新建企业/ }).check();
  const submit = page.getByRole("button", { name: "开通并开始发布招聘" });

  await submit.click();
  const name = page.getByLabel("店名", { exact: true });
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("请填写店名")).toBeVisible();

  await name.fill("确认测试店");
  await submit.click();
  await expect(page.getByText("请选择地区")).toBeVisible();
  await expect(page.locator("#business-area")).toBeFocused();
  await expect(name).not.toHaveAttribute("aria-invalid", "true");
});

test("another business choice clears the business step's error (rework 3 #3)", async ({ page }) => {
  await page.goto("/login?role=employer&next=%2Femployer%2Fpost");
  await page.getByLabel("邮箱", { exact: true }).fill(freshEmail("e2e.b.confirm"));
  await page.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(page);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "开通雇主身份" })).toBeVisible();
  // The other choice is a demo shop, and those are free only until other specs in the run claim them (e1, e2 and e4
  // are shared by every account; a new business is never one). The same rule is unit-tested in identity.test.ts
  // (businessErrorAt), which runs every time.
  const freeShop = page.locator('input[name="business"]:not([value="new"]):not(:disabled)').first();
  test.skip((await freeShop.count()) === 0, "every demo shop is claimed by an earlier spec in this run");
  await page.getByRole("radio", { name: /新建企业/ }).check();
  const name = page.getByLabel("店名", { exact: true });
  await name.fill("确认测试店");
  await page.getByRole("button", { name: "开通并开始发布招聘" }).click();
  await expect(page.getByText("请选择地区")).toBeVisible();
  await freeShop.check();
  await expect(page.getByText("请选择地区")).toBeHidden();
  await page.getByRole("radio", { name: /新建企业/ }).check();
  await expect(name).not.toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#business-area")).not.toHaveAttribute("aria-describedby", "business-area-error");
  await expect(page.getByText("请选择地区")).toBeHidden();
});

test("驳回举报 asks first; 取消 gives the focus back (rework 13)", async ({ browser, page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);
  const id = await publishJob(page, title);
  await page.goto(`/jobs/${id}`);
  await openReportForm(page);
  await page.getByRole("group", { name: "举报这个职位" }).getByLabel("收押金 / 介绍费").check();
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");

  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await openAdminTab(admin, /被举报/);
  const card = admin.getByRole("article").filter({ has: admin.getByRole("heading", { name: title }) });
  const dismiss = card.getByRole("button", { name: "驳回举报", exact: true });
  await dismiss.click();
  const confirm = card.getByRole("button", { name: "确定驳回，职位照常显示" });
  await expect(confirm).toBeFocused();
  await card.getByRole("button", { name: "取消" }).click();
  await expect(dismiss).toBeFocused();
  await expect(confirm).toHaveCount(0);

  await dismiss.click();
  await card.getByRole("button", { name: "确定驳回，职位照常显示" }).click();
  await expect(admin.getByRole("status")).toContainText("已处理");
  await expect(card).toHaveCount(0);
  await admin.context().close();
});

test("a shop photo's 删除 asks first; 取消 gives the focus back (rework 13)", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo, "/employer/photos");
  await page.getByLabel("选择照片").setInputFiles({ name: "shop.png", mimeType: "image/png", buffer: PNG });
  await expect(page.getByRole("main").getByRole("status")).toHaveText("已上传，等审核员看过就会公开。");

  const remove = page.getByRole("button", { name: "删除第 1 张照片" });
  await remove.click();
  await expect(page.getByRole("button", { name: "确认删除第 1 张照片" })).toBeFocused();
  await page.getByRole("button", { name: "不删第 1 张照片" }).click();
  await expect(remove).toBeFocused();
  await expect(page.getByRole("img", { name: "第 1 张门店照片" })).toBeVisible();

  await remove.click();
  await page.getByRole("button", { name: "确认删除第 1 张照片" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText("照片已删除。");
  await expect(page.getByText("还没有门店照片。")).toBeVisible();
});

test("按表格重新生成 over a hand-written description asks first; 取消 gives the focus back (rework 13)", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  await openTheForm(page);
  await page.getByRole("button", { name: "不用粘贴，直接填表" }).click();
  await page.getByLabel("职位名称（中文）").fill("前厅服务员");
  const english = page.getByLabel(/^英文描述/);
  await english.fill("Written by hand.");

  const regenerate = page.getByRole("button", { name: "按表格重新生成" });
  await regenerate.click();
  await expect(page.getByRole("button", { name: "确定重新生成" })).toBeFocused();
  await page
    .getByRole("group", { name: /手改过的英文描述/ })
    .getByRole("button", { name: "取消" })
    .click();
  await expect(regenerate).toBeFocused();
  await expect(english).toHaveValue("Written by hand.");

  await regenerate.click();
  await page.getByRole("button", { name: "确定重新生成" }).click();
  await expect(english).not.toHaveValue("Written by hand.");
  // Written from the form again, it follows the form: the next press does not ask.
  await regenerate.click();
  await expect(page.getByRole("button", { name: "确定重新生成" })).toHaveCount(0);
});
