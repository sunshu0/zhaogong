import { expect, test } from "@playwright/test";
import { cardMenuItem, CLEAN_MESSAGE, openTheForm, publishFromPreview, signUpEmployer, uniqueTitle } from "./helpers";

test("contact details are private by default; an edit can make them public", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("前厅服务员", testInfo);

  await openTheForm(page);
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await page.getByRole("button", { name: "整理成职位" }).click();
  await page.getByLabel("职位名称（中文）").fill(title);
  // Private is the default: nothing to fill in, and the details from the message are not shown.
  await expect(page.getByRole("radio", { name: /^不公开，求职者在聊天中申请交换/ })).toBeChecked();
  await expect(page.getByLabel("微信号")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "企业主页" })).toHaveAttribute("href", "/profile");

  await page.getByRole("button", { name: "预览", exact: true }).click();
  await expect(page.getByText("雇主没有公开联系方式").filter({ visible: true })).toBeVisible();
  await publishFromPreview(page);
  await expect(page.getByText("求职者点链接后在聊天里联系你").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "微信群文案" })).toHaveValue(/详情和在线沟通/);

  await page.goto("/employer/jobs");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card).toContainText("不公开 · 聊天交换");

  await (await cardMenuItem(card, "编辑")).click();
  await expect(page.getByRole("heading", { name: "编辑职位" })).toBeVisible();
  await page.getByRole("radio", { name: /^公开给登录的求职者/ }).check();
  await expect(page.getByText("没有识别到，请填写").filter({ visible: true })).toBeVisible();
  await page.getByLabel("电话").fill("021 555 0199");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByText("已保存").filter({ visible: true })).toBeVisible();

  await page.goto("/employer/jobs");
  await expect(card).toContainText("0 人查看了联系方式");
});
