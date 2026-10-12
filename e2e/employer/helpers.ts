// Helpers for line B's browser tests. Run them on line B's server: `E2E_PORT=8703 npx playwright test e2e/employer`.
import { expect, type Page, type TestInfo } from "@playwright/test";

/** A job message with nothing for the checks to object to. Its parsed title is a demo job's (前厅服务员), so give every published job a uniqueTitle(). */
export const CLEAN_MESSAGE = "Mt Eden 川菜馆招前厅服务员，时薪 $25-27，每周 15-25 小时，包工作餐，学签可做，需会普通话。微信 demo_e2e_b";

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

/** Signs in on the preview step's panel as a demo business. */
export async function signInAs(page: Page, business = "川味小馆", email = "e2e.employer@example.com") {
  await page.getByLabel("邮箱", { exact: true }).fill(email);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await page.getByLabel("验证码", { exact: true }).fill("123456");
  await page.getByRole("radio", { name: new RegExp(business) }).check();
  await page.getByRole("button", { name: "登录", exact: true }).click();
}

/** From the preview step: sign in if needed, publish, and return the new job's id. */
export async function publishFromPreview(page: Page, button: "发布" | "提交审核" = "发布"): Promise<string | undefined> {
  await expect(page.getByText("这是求职者看到的样子").filter({ visible: true })).toBeVisible();
  if (await page.getByLabel("邮箱", { exact: true }).isVisible()) await signInAs(page);
  await expect(page.getByText("以「川味小馆」发布").filter({ visible: true })).toBeVisible();
  await page.getByRole("button", { name: button, exact: true }).click();
  if (button === "提交审核") {
    await expect(page.getByRole("heading", { name: "已提交审核" })).toBeVisible();
    return undefined;
  }
  await expect(page.getByRole("heading", { name: "已发布" })).toBeVisible();
  const href = await page.getByRole("link", { name: "看看职位页面" }).getAttribute("href");
  return href?.split("/").pop();
}

/** Pastes a message, gives the job its own title, and publishes it. */
export async function publishJob(page: Page, title: string, message = CLEAN_MESSAGE): Promise<string | undefined> {
  await page.goto("/employer/post");
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(message);
  await page.getByRole("button", { name: "整理成职位" }).click();
  await page.getByLabel("职位名称（中文）").fill(title);
  await page.getByRole("button", { name: "预览", exact: true }).click();
  return publishFromPreview(page, /KTV|按摩/.test(message) ? "提交审核" : "发布");
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
