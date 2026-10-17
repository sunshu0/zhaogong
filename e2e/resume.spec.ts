import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { chooseOption, expectProfileSaved, freshEmail, selectTrigger, signIn, siteNav } from "./helpers";

// 中英文简历 (#86, R-37): made from the job seeker's page; the English side is only what they wrote; prints as one
// A4 page; a share link (off by default, no email on it) can be updated and closed.

const sheet = (page: Page) => page.getByRole("article", { name: "中英文简历" }).filter({ visible: true });

async function openResume(page: Page) {
  await signIn(page, "/profile", freshEmail("demo.resume")); // starts with 林晓's demo page (#125)
  await page.getByLabel("交换用电话").fill("09 055 0186");
  await page.getByLabel("交换用邮箱").fill("lin.resume@example.com");
  await expectProfileSaved(page);
  await page.getByRole("link", { name: "生成简历" }).click();
  await expect(page).toHaveURL("/profile/resume");
  await expect(sheet(page)).toBeVisible();
}

/** The share link opened by someone who is not signed in. */
async function asStranger(browser: Browser, path: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(path);
  return { page, close: () => context.close() };
}

test("prints the page in Chinese with the English written, states the visa, and fits one A4 page", async ({
  page,
}, testInfo) => {
  await openResume(page);
  await expect(page.getByRole("note")).toContainText("英文还缺");
  await expect(sheet(page)).toContainText("林晓");

  await page.getByLabel("称呼（英文）").fill("Xiao Lin");
  await page.getByLabel("语言（英文）").fill("Mandarin, English");
  await expect(sheet(page)).toContainText("Xiao Lin");
  await expect(sheet(page)).toContainText("Mandarin, English");
  await expect(page.getByRole("note")).not.toContainText("语言");

  await chooseOption(page, page, "持有的签证", "持学签");
  await page.getByLabel("每周可工作（小时，选填）").fill("20");
  await expect(sheet(page)).toContainText("持学签，每周可工作 20 小时");
  await expect(sheet(page)).toContainText("Student visa; may work up to 20 hours a week");
  await expect(sheet(page)).toContainText("签证情况由本人填写");

  await expect(sheet(page)).not.toContainText("09 055 0186");
  await page.getByRole("checkbox", { name: /电话/ }).check();
  await page.getByRole("checkbox", { name: /邮箱/ }).check();
  await expect(sheet(page)).toContainText("09 055 0186");
  await expect(sheet(page)).toContainText("lin.resume@example.com");

  // Kept in this browser with the rest of the page.
  await page.reload();
  await expect(sheet(page)).toContainText("Xiao Lin");
  await expect(selectTrigger(page, "持有的签证")).toHaveAccessibleName("持有的签证 持学签");

  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);

  await page.emulateMedia({ media: "print" });
  await expect(sheet(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "打印 / 存为 PDF" })).toBeHidden();
  await expect(page.getByRole("heading", { name: "英文资料" })).toBeHidden();
  await expect(siteNav(page)).toBeHidden();
  const pdf = (await page.pdf({ format: "A4", preferCSSPageSize: true })).toString("latin1");
  expect(pdf.match(/\/Type\s*\/Page[^s]/g), `${testInfo.project.name}: one A4 page`).toHaveLength(1);
});

test("shares a link without the email, updates what it shows, and closes it", async ({ page, browser }) => {
  await openResume(page);
  await page.getByRole("checkbox", { name: /电话/ }).check();
  await page.getByRole("checkbox", { name: /邮箱/ }).check();
  await expect(page.getByText("分享链接里不显示邮箱")).toBeVisible();

  await page.getByRole("button", { name: "生成分享链接" }).click();
  const link = page.locator("#resume-share").getByRole("link", { name: /\/resume\// });
  await expect(link).toBeVisible();
  const path = new URL((await link.textContent())!).pathname;
  expect(path).toMatch(/^\/resume\/[A-Za-z0-9_-]{24}$/);
  await expect(page.getByRole("button", { name: "更新分享内容" })).toBeDisabled();

  let stranger = await asStranger(browser, path);
  await expect(sheet(stranger.page)).toContainText("林晓");
  await expect(sheet(stranger.page)).toContainText("09 055 0186");
  await expect(sheet(stranger.page)).not.toContainText("lin.resume@example.com");
  await expect(sheet(stranger.page)).not.toContainText("邮箱");
  await stranger.close();

  await page.getByLabel("个人介绍（英文）").fill("Two years in restaurants.");
  await expect(page.getByText("资料改过了")).toBeVisible();
  await page.getByRole("button", { name: "更新分享内容" }).click();
  await expect(page.getByText("资料改过了")).toBeHidden();
  stranger = await asStranger(browser, path);
  await expect(sheet(stranger.page)).toContainText("Two years in restaurants.");
  await stranger.close();

  await page.getByRole("button", { name: "关闭链接" }).click();
  await expect(page.getByRole("button", { name: "生成分享链接" })).toBeVisible();
  stranger = await asStranger(browser, path);
  await expect(stranger.page.getByRole("heading", { name: "这份简历的分享链接已关闭或不存在" })).toBeVisible();
  await stranger.close();
});
