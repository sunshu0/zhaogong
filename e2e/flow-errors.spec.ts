// #178: a part of a long flow that fails keeps what the user typed. The posting form's steps and the open chat sit
// in their own error boundaries; the browser tests' build makes a part fail on purpose (src/lib/test-crash.ts).
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";
import { openTheForm, publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";
import { TEST_CRASH_KEY } from "../src/lib/test-crash";
import { waitForTitle } from "./helpers/title";

test.use({ reducedMotion: "reduce" });

const failNext = (page: Page, part: string) =>
  page.evaluate(([k, v]) => localStorage.setItem(k, v), [TEST_CRASH_KEY, part]);
const stopFailing = (page: Page) => page.evaluate((k) => localStorage.removeItem(k), TEST_CRASH_KEY);

async function expectNoViolations(page: Page) {
  await waitForTitle(page);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
}

test("a posting step that fails shows 重试 in its place and keeps the form; the draft also survives a reload", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  await openTheForm(page);
  await page.getByRole("button", { name: "用示例试试" }).click();
  await page.getByRole("button", { name: "整理成职位" }).click();
  const title = page.getByLabel("职位名称（中文）");
  const name = uniqueTitle("出错测试", testInfo);
  await title.fill(name);

  // The next render of the step fails: the steps list stays, the step itself gives way to 重试.
  await failNext(page, "post");
  await title.fill(`${name}甲`);
  const failed = page.getByRole("alert").filter({ hasText: "这一步没显示出来" });
  await expect(failed).toBeVisible();
  await expect(failed).toContainText("你填的内容还在");
  await expect(page.getByRole("list", { name: "发布步骤" }).locator('[aria-current="step"]')).toContainText("核对");
  await expectNoViolations(page);

  await stopFailing(page);
  await failed.getByRole("button", { name: "重试" }).click();
  await expect(title).toHaveValue(`${name}甲`);

  // A reload picks up the draft kept in this tab, and says so; 清空重来 drops it.
  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "接着上次没写完的继续" })).toBeVisible();
  await expect(page.getByLabel("职位名称（中文）")).toHaveValue(`${name}甲`);
  await page.getByRole("button", { name: "清空重来" }).click();
  await page.getByRole("button", { name: "确定清空", exact: true }).click();
  await expect(page.getByRole("button", { name: "直接填表", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "直接填表", exact: true })).toBeVisible();
  await expect(page.getByText("接着上次没写完的继续")).toBeHidden();
});

test("an open chat that fails keeps the unsent words; 重试 opens it again", async ({ page }, testInfo) => {
  await signIn(page, "/messages", freshEmail("demo.flow-errors"));
  const list = page.getByRole("complementary", { name: "聊天列表" });
  await list.getByRole("button", { name: /北岸早茶酒家/ }).click();
  const input = page.getByLabel("输入消息");
  await input.fill("我明天下午有空");

  await failNext(page, "chat");
  await input.fill("我明天下午有空，");
  const failed = page.getByRole("alert").filter({ hasText: "这段聊天没显示出来" });
  await expect(failed).toBeVisible();
  // On a wide screen the list stays beside it.
  if (testInfo.project.name === "desktop") await expect(list).toBeVisible();
  await expectNoViolations(page);

  await stopFailing(page);
  await failed.getByRole("button", { name: "重试" }).click();
  await expect(page.getByLabel("输入消息")).toHaveValue("我明天下午有空，");
  await expect(page.getByRole("log")).toBeVisible();
});

test("editing a job: a form that fails keeps the changes, a reload picks them up, 放弃改动 goes back (#193)", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("编辑出错测试", testInfo);
  const jobId = await publishJob(page, title);
  await page.goto(`/employer/jobs/${jobId}`);
  await expect(page.getByRole("heading", { name: "编辑职位" })).toBeVisible();
  const name = page.getByLabel("职位名称（中文）");
  await name.fill(`${title}乙`);
  // The business's profile loads after the form shows and redraws it: once failNext is set, that redraw would fail
  // the form before the second fill (gate 10-24 e7). Let the loads finish first.
  await page.waitForLoadState("networkidle");

  await failNext(page, "job-form");
  await name.fill(`${title}丙`);
  const failed = page.getByRole("alert").filter({ hasText: "表单没显示出来" });
  await expect(failed).toBeVisible();
  await expect(failed).toContainText("你改的内容还在");
  await expectNoViolations(page);

  await stopFailing(page);
  await failed.getByRole("button", { name: "重试" }).click();
  await expect(name).toHaveValue(`${title}丙`);

  await page.reload();
  await expect(page.getByRole("status").filter({ hasText: "接着上次没保存的改动继续" })).toBeVisible();
  await expect(page.getByLabel("职位名称（中文）")).toHaveValue(`${title}丙`);
  await page.getByRole("button", { name: "放弃改动" }).click();
  await expect(page.getByLabel("职位名称（中文）")).toHaveValue(title);
});
