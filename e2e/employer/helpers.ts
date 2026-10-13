// Helpers for line B's browser tests. Run them on line B's server: `E2E_PORT=8703 npx playwright test e2e/employer`.
import { expect, type Page, type TestInfo } from "@playwright/test";

/** A job message with nothing for the checks to object to. Its parsed title is a demo job's (前厅服务员), so give every published job a uniqueTitle(). */
export const CLEAN_MESSAGE =
  "Mt Eden 川菜馆招前厅服务员，时薪 $25-27，每周 15-25 小时，包工作餐，学签可做，需会普通话。微信 demo_e2e_b";

/**
 * A title no other test run uses, so a test can find its own job on the shared server.
 * Both projects run in parallel, hence the project and worker in it.
 */
export function uniqueTitle(base: string, testInfo: TestInfo): string {
  return `${base}${testInfo.project.name === "mobile" ? "M" : "D"}${testInfo.workerIndex}${Date.now() % 1_000_000}`;
}

export function findingsPanel(page: Page) {
  return page.locator("section", { has: page.getByRole("heading", { name: "发布前检查" }) });
}

/**
 * Signs up as an employer through line A's sign-up (/login?role=employer): a fresh email and a new
 * business each time, because a business belongs to one account only and the specs run side by side.
 * Ends on `next`. Returns the business name.
 */
export async function signUpEmployer(page: Page, testInfo: TestInfo, next = "/employer/post"): Promise<string> {
  const run = `${testInfo.project.name === "mobile" ? "M" : "D"}${testInfo.workerIndex}${Date.now() % 1_000_000}`;
  const shop = `测试店${run}`;
  await page.goto(`/login?role=employer&next=${encodeURIComponent(next)}`);
  await page.getByLabel("邮箱", { exact: true }).fill(`e2e.b.${run}@example.com`);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await page.getByLabel("验证码").fill("123456");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "开通雇主身份" })).toBeVisible();
  await page.getByRole("radio", { name: /新建企业/ }).check();
  await page.getByLabel("店名", { exact: true }).fill(shop);
  await page.getByRole("combobox", { name: /^地区/ }).selectOption({ label: "市中心" });
  await page.getByRole("button", { name: "开通并开始发布招聘" }).click();
  await expect(page).toHaveURL(next);
  return shop;
}

/** From the preview step: publish as the signed-up business and return the new job's id. */
export async function publishFromPreview(
  page: Page,
  button: "发布" | "提交审核" = "发布",
): Promise<string | undefined> {
  await expect(page.getByText("这是求职者看到的样子").filter({ visible: true })).toBeVisible();
  await expect(page.getByText(/^以「.+」发布$/).filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: button, exact: true }).click();
  if (button === "提交审核") {
    await expect(page.getByRole("heading", { name: "已提交审核" })).toBeVisible();
    return undefined;
  }
  await expect(page.getByRole("heading", { name: "已发布" })).toBeVisible();
  const href = await page.getByRole("link", { name: "看看职位页面" }).getAttribute("href");
  return href?.split("/").pop();
}

/** Pastes a message, gives the job its own title, and publishes it. Sign up first (signUpEmployer). */
export async function publishJob(page: Page, title: string, message = CLEAN_MESSAGE): Promise<string | undefined> {
  await page.goto("/employer/post");
  await openTheForm(page);
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(message);
  await page.getByRole("button", { name: "整理成职位" }).click();
  await page.getByLabel("职位名称（中文）").fill(title);
  await page.getByRole("button", { name: "预览", exact: true }).click();
  return publishFromPreview(page, /KTV|按摩/.test(message) ? "提交审核" : "发布");
}

/** /employer/post opens in chat mode; the paste → form flow is behind 直接填表. */
export async function openTheForm(page: Page) {
  await page.getByRole("button", { name: "直接填表", exact: true }).click();
  await expect(page.getByLabel(/把微信群里的招聘消息粘贴进来/)).toBeVisible();
}

/** The public job list at /jobs (not / since A11), searched for one title. */
export async function searchJobList(page: Page, title: string) {
  const query = `q=${encodeURIComponent(title)}`;
  await page.goto(`/jobs?${query}`);
  await expect(page).toHaveURL(`/jobs?${query}`);
}

/** A job card on the seekers' list (not the "去掉条件" chip, whose name also holds the search). */
export function jobCard(page: Page, title: string) {
  return page.getByRole("link", { name: new RegExp(`^${title}`) });
}

const CJK_DIGITS = "零一二三四五六七八九";

/**
 * A unique title the chat can read back: the parser takes 2–10 Chinese characters, so the run's
 * number is written in 汉字 digits. Keep `base` to 3 characters or fewer.
 */
export function uniqueCjkTitle(base: string, testInfo: TestInfo): string {
  const n = String(Date.now() % 100_000).padStart(5, "0");
  return (
    base +
    (testInfo.project.name === "mobile" ? "甲" : "乙") +
    CJK_DIGITS[testInfo.workerIndex % 10] +
    [...n].map((d) => CJK_DIGITS[Number(d)]).join("")
  );
}

/** Sends a chat message the way a person types it: fill the box, press Enter. */
export async function sayInChat(page: Page, text: string) {
  const box = page.getByLabel("回复助手");
  await box.fill(text);
  await box.press("Enter");
  await expect(box).toHaveValue("");
  await expect(page.getByText("助手正在整理…")).toHaveCount(0);
}

/** The assistant's latest message. */
export function lastAssistant(page: Page) {
  return page.getByRole("log").getByRole("listitem").filter({ hasText: "助手：" }).last();
}
