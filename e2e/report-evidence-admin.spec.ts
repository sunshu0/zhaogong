import { expect, test } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";
import { moderatorPage, openAdminTab } from "./employer/helpers";

// 举报证据 in /admin (#353, ADR 0027 §3): the queue says how much evidence a report carries; 查看证据 shows the
// messages (each marked who sent it) and the screenshot, and opening it is recorded in 查看记录 (ADR 0026).

test("a moderator opens a report's message and screenshot, and the opening is in 查看记录", async ({
  page,
  browser,
}, testInfo) => {
  const words = `押金要先交吗${testInfo.project.name}${Date.now() % 100_000}`;
  const note = `证据测试${testInfo.project.name}${Date.now() % 100_000}`;
  await signIn(page, "/jobs/j1", freshEmail("e2e.evidence.admin"));
  await page.getByRole("button", { name: "立即沟通" }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=employer%3A/);
  await page.getByLabel("输入消息").fill(words);
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByRole("log", { name: "消息记录" })).toContainText(words);

  // The message reaches the server a moment after the page shows it: open the report until the list has it.
  const pick = page.getByRole("checkbox", { name: new RegExp(words) });
  await expect(async () => {
    await page.goto("/jobs/j1");
    await page.getByRole("button", { name: "举报这个职位" }).click();
    await expect(pick).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await page.getByLabel("收押金 / 介绍费").check();
  await pick.check();
  await page.getByLabel("补充说明（选填）").fill(note);
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 200, height: 120 } });
  await page.getByRole("group", { name: "附上截图（选填）" }).getByLabel("选择截图").setInputFiles({
    name: "聊天截图.png",
    mimeType: "image/png",
    buffer: shot,
  });
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");

  const admin = await moderatorPage(browser, testInfo);
  await admin.goto("/admin");
  await openAdminTab(admin, /^被举报/);
  // The job's card is a list item too; the report's own item is the innermost one with the note.
  const report = admin.getByRole("listitem").filter({ hasText: note }).last();
  await expect(report).toBeVisible();
  // The queue holds only the counts: the words come when the evidence is opened.
  await expect(admin.getByRole("tabpanel").first()).not.toContainText(words);
  await report.getByRole("button", { name: "查看证据：1 条聊天消息、1 张截图" }).click();
  const messages = report.getByRole("list", { name: "举报附的聊天消息" });
  await expect(messages).toContainText(words);
  await expect(messages).toContainText("举报人");
  const image = report.getByRole("img", { name: "截图 1" });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(report.getByRole("button", { name: "收起证据" })).toHaveAttribute("aria-expanded", "true");

  await openAdminTab(admin, /^查看记录/);
  const log = admin.getByRole("region", { name: "审核员看过谁的个人信息" });
  await expect(log.getByRole("row").nth(1)).toContainText("聊天");
  await expect(log).not.toContainText(words);
  await admin.context().close();
});
