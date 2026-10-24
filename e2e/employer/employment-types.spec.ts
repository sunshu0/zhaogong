import { expect, test } from "@playwright/test";
import { openFromList } from "../helpers";
import { jobCard, openTheForm, publishFromPreview, signUpEmployer, uniqueTitle } from "./helpers";

test("multiple types survive posting, filtering, sharing and editing", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("多类型服务员", testInfo);
  await openTheForm(page);
  await page
    .getByLabel(/把微信群里的招聘消息粘贴进来/)
    .fill("Mt Eden 餐馆招服务员，全职或兼职，时薪28，每周20小时，包餐，学签可做，微信 demo_multi");
  await page.getByRole("button", { name: "整理成职位" }).click();
  await page.getByLabel("职位名称（中文）").fill(title);
  const types = page.getByRole("group", { name: /^工作类型/ });
  await expect(types.getByRole("checkbox", { name: "全职", exact: true })).toBeChecked();
  await expect(types.getByRole("checkbox", { name: "兼职", exact: true })).toBeChecked();
  await expect(types.getByRole("checkbox", { name: "临时工", exact: true })).not.toBeChecked();
  await types.getByRole("checkbox", { name: "全职", exact: true }).uncheck();
  await types.getByRole("checkbox", { name: "兼职", exact: true }).uncheck();
  await expect(page.getByRole("button", { name: "预览", exact: true })).toBeDisabled();
  for (const name of ["全职", "兼职", "临时工"]) {
    await types.getByRole("checkbox", { name, exact: true }).check();
  }
  await page.screenshot({ path: testInfo.outputPath("multi-type-form.png"), fullPage: true });
  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.getByRole("main")).toContainText("全职 / 兼职 / 临时工");
  const id = await publishFromPreview(page);
  expect(id).toBeTruthy();
  await expect(page.getByRole("textbox", { name: "微信群文案" })).toHaveValue(/全职 \/ 兼职 \/ 临时工/);

  for (const type of ["full_time", "part_time", "casual"]) {
    await page.goto(`/jobs?type=${type}&q=${encodeURIComponent(title)}`);
    await expect(jobCard(page, title)).toContainText("全职 / 兼职 / 临时工");
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("multi-type-list.png"), fullPage: true });
  await openFromList(page, jobCard(page, title).getByRole("link", { name: new RegExp(`^${title}`) }));
  await expect(page.getByRole("main")).toContainText("全职 / 兼职 / 临时工");

  await page.goto(`/employer/jobs/${id}`);
  for (const name of ["全职", "兼职", "临时工"]) {
    await expect(types.getByRole("checkbox", { name, exact: true })).toBeChecked();
  }
  await types.getByRole("checkbox", { name: "全职", exact: true }).uncheck();
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("heading", { name: "已保存" })).toBeVisible();
  await page.getByRole("link", { name: "查看职位", exact: true }).click();
  await expect(page.getByRole("definition").filter({ hasText: "兼职 / 临时工" })).toBeVisible();
  await page.goto(`/jobs?type=full_time&q=${encodeURIComponent(title)}`);
  await expect(jobCard(page, title)).toHaveCount(0);
  await page.goto(`/jobs?type=casual&q=${encodeURIComponent(title)}`);
  await expect(jobCard(page, title)).toContainText("兼职 / 临时工");
});
