import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { chooseOption } from "../helpers";
import { waitForTitle } from "../helpers/title";
import { moderatorPage, openAdminTab, openReportForm, publishJob, signUpEmployer, uniqueTitle } from "./helpers";

// 门店照片和福利 (F8, ADR 0052): a business's admin uploads shop photos and ticks benefits; a photo shows on the public
// 企业主页 only once a moderator approved it, and one sent back loses its file. The photo route hands a waiting photo
// to the business and moderators only, and nothing of a banned business.

// axe scans the settled page, as in a11y.spec.ts.
test.use({ reducedMotion: "reduce" });

async function expectNoViolations(page: Page, state: string) {
  await waitForTitle(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const found = violations.map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target).join(", ")}`);
  expect.soft(found, `${state}\n${found.join("\n")}`).toEqual([]);
}

/** A 1×1 PNG: the browser draws it again (as WebP) before sending, as it would a camera photo. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

/** Uploads one file on /employer/photos and waits for the answer. */
async function upload(page: Page, file: { name: string; mimeType: string; buffer: Buffer }, said: string) {
  await page.getByLabel("选择照片").setInputFiles(file);
  await expect(page.getByRole("main").getByRole("status")).toHaveText(said);
}

const UPLOADED = "已上传，等审核员看过就会公开。";
const shopPhoto = (n: number) => ({ name: `shop-${n}.png`, mimeType: "image/png", buffer: PNG });

/** The business's id, from the 看企业主页 link on /employer/photos. */
async function businessId(page: Page) {
  return (await page.getByRole("link", { name: "看企业主页" }).getAttribute("href"))!.split("/").pop()!;
}

/** A signed-out browser beside the test's own page, same viewport. */
async function visitorPage(browser: Browser, testInfo: TestInfo) {
  return (await browser.newContext({ ...testInfo.project.use })).newPage();
}

test("a photo shows on the public page only once approved; one sent back loses its file", async ({
  browser,
  page,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/employer/photos");
  await expect(page.getByText("还没有门店照片。")).toBeVisible();
  await upload(page, shopPhoto(1), UPLOADED);
  await expect(page.getByText("等待审核")).toBeVisible();
  const first = (await page.getByRole("img", { name: "第 1 张门店照片" }).getAttribute("src"))!;
  const employerId = await businessId(page);

  // Benefits save themselves on the tick and show at once, with nothing to review.
  await page.getByRole("checkbox", { name: "包餐" }).check();
  await expect(page.getByText("已自动保存，企业主页上马上能看到。")).toBeVisible();

  // Waiting: the business sees its photo, never cached; a visitor gets nothing.
  const own = await page.request.get(first);
  expect(own.status()).toBe(200);
  expect(own.headers()["cache-control"]).toBe("private, no-store");
  const visitor = await visitorPage(browser, testInfo);
  expect((await visitor.request.get(first)).status()).toBe(404);
  await visitor.goto(`/employers/${employerId}`);
  await expect(visitor.getByRole("heading", { name: shop, exact: true })).toBeVisible();
  await expect(visitor.getByRole("list", { name: "福利" })).toContainText("包餐");
  await expect(visitor.getByRole("img", { name: `${shop} 的门店照片 1` })).toHaveCount(0);

  // A moderator approves it: the visitor sees it, and a browser may keep it a while.
  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await openAdminTab(admin, /^门店照片/);
  const card = admin.getByRole("article", { name: `门店照片：${shop}` });
  await expect(card.getByRole("img", { name: `${shop} 上传的门店照片` })).toBeVisible();
  await card.getByRole("button", { name: "通过" }).click();
  await expect(admin.getByRole("status")).toContainText(shop);
  await expect(card).toHaveCount(0);
  await visitor.reload();
  await expect(visitor.getByRole("img", { name: `${shop} 的门店照片 1` })).toBeVisible();
  const open = await visitor.request.get(first);
  expect(open.status()).toBe(200);
  expect(open.headers()["cache-control"]).toBe("public, max-age=600");

  // A second one is sent back with a reason: the business reads why, and its file is gone.
  await page.reload();
  await upload(page, shopPhoto(2), UPLOADED);
  const second = (await page.getByRole("img", { name: "第 2 张门店照片" }).getAttribute("src"))!;
  await admin.reload();
  await openAdminTab(admin, /^门店照片/);
  await chooseOption(admin, card, "退回理由", "看不清");
  // exact: the reason picker's button is named 退回理由 too.
  await card.getByRole("button", { name: "退回", exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("被退回：看不清")).toBeVisible();
  await expect(page.getByText("1 / 6 张")).toBeVisible();
  await expectNoViolations(page, "/employer/photos with a photo approved and one sent back");
  expect((await page.request.get(second)).status()).toBe(404);
  await visitor.reload();
  await expect(visitor.getByRole("img", { name: /的门店照片/ })).toHaveCount(1);
  await expectNoViolations(visitor, "/employers/[id] with a photo and a benefit");

  // The business is told in its notifications, which lead back to the photos page.
  await page.goto("/notifications");
  await page
    .getByRole("region", { name: "通知列表" })
    .getByRole("link", { name: /有一张门店照片被退回/ })
    .click();
  await expect(page).toHaveURL(/\/employer\/photos$/);

  await admin.context().close();
  await visitor.context().close();
});

test("a text file named .png and a seventh photo are refused; a banned business's photos are not served", async ({
  browser,
  page,
}, testInfo) => {
  test.slow(); // six uploads and a report
  const shop = await signUpEmployer(page, testInfo, "/employer/photos");
  await upload(
    page,
    { name: "menu.png", mimeType: "image/png", buffer: Buffer.from("微信 abc123，电话 021 000 0000") },
    "只能上传 JPG、PNG 或 WebP 图片。",
  );
  await expect(page.getByText("0 / 6 张")).toBeVisible();
  for (let n = 1; n <= 6; n++) {
    await upload(page, shopPhoto(n), UPLOADED);
    await expect(page.getByText(`${n} / 6 张`)).toBeVisible();
  }
  // Full: the button is off and says why (the server refuses a seventh as well, db/employer-photos.test.ts).
  await expect(page.getByLabel("选择照片")).toBeDisabled();
  await expect(page.getByText("已经有 6 张了：删掉一张再上传。")).toBeVisible();
  const employerId = await businessId(page);
  // The oldest is approved below; the second stays waiting.
  const waiting = (await page.getByRole("img", { name: "第 2 张门店照片" }).getAttribute("src"))!;

  // One approved, so it is public before the ban.
  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await openAdminTab(admin, /^门店照片/);
  await admin
    .getByRole("article", { name: `门店照片：${shop}` })
    .first()
    .getByRole("button", { name: "通过" })
    .click();
  await expect(admin.getByRole("status")).toContainText(shop);
  const visitor = await visitorPage(browser, testInfo);
  await visitor.goto(`/employers/${employerId}`);
  const photo = (await visitor.getByRole("img", { name: `${shop} 的门店照片 1` }).getAttribute("src"))!;
  expect((await visitor.request.get(photo)).status()).toBe(200);

  // Its job is reported and the business banned for 3 days: neither the public photo nor a waiting one is served.
  const title = uniqueTitle("前厅服务员", testInfo);
  const jobId = await publishJob(page, title);
  await page.goto(`/jobs/${jobId}`);
  await openReportForm(page);
  await page.getByRole("group", { name: "举报这个职位" }).getByLabel("收押金 / 介绍费").check();
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");
  await admin.goto("/admin");
  await openAdminTab(admin, /被举报/);
  const reported = admin.getByRole("article").filter({ has: admin.getByRole("heading", { name: title }) });
  await reported.getByRole("button", { name: "封禁雇主" }).click();
  const choice = reported.getByRole("group", { name: `封禁「${shop}」` });
  await choice.getByLabel("暂时封禁 3 天").check();
  await choice.getByLabel(/^原因（雇主的团队会看到/).fill("门店照片测试");
  await choice.getByRole("button", { name: /^确定/ }).click();
  await expect(admin.getByRole("status")).toContainText("暂时封禁雇主");

  expect((await visitor.request.get(photo)).status()).toBe(404);
  expect((await page.request.get(waiting)).status()).toBe(404);
  expect((await admin.request.get(photo)).status()).toBe(404);

  await admin.context().close();
  await visitor.context().close();
});
