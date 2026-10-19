import { expect, test } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";

// 举报附证据 (ADR 0027): a signed-in job seeker attaches messages of their own chat with the job's business to a
// report on the job; signed out there is nothing to attach.

test("report a job with a message of my chat with its business", async ({ page }) => {
  await signIn(page, "/jobs/j1", freshEmail("e2e.report.evidence"));
  await page.getByRole("button", { name: "立即沟通" }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=employer%3A/);
  await page.getByLabel("输入消息").fill("你们要先交押金吗？");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByRole("log", { name: "消息记录" })).toContainText("你们要先交押金吗？");

  // The message reaches the server a moment after the page shows it: open the report until the list has it.
  const pick = page.getByRole("checkbox", { name: /你们要先交押金吗？/ });
  await expect(async () => {
    await page.goto("/jobs/j1");
    await page.getByRole("button", { name: "举报这个职位" }).click();
    await expect(pick).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });

  const evidence = page.getByRole("group", { name: "附上聊天记录（选填）" });
  await expect(evidence).toContainText("最多 20 条");
  await expect(evidence).toContainText("已选 0 / 20 条");
  await page.getByLabel("收押金 / 介绍费").check();
  await pick.check();
  await expect(evidence).toContainText("已选 1 / 20 条");
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");
});

test("signed out, a report has no chat messages to attach", async ({ page }) => {
  await page.goto("/jobs/j2");
  await page.getByRole("button", { name: "举报这个职位" }).click();
  await expect(page.getByRole("group", { name: "举报这个职位" })).toBeVisible();
  await expect(page.getByText("附上聊天记录（选填）")).toHaveCount(0);
});

test("report a job with a screenshot; only JPG, PNG and WebP; nobody but a moderator can open it", async ({
  page,
  request,
}) => {
  await signIn(page, "/jobs/j3", freshEmail("e2e.report.image"));
  await page.getByRole("button", { name: "举报这个职位" }).click();
  const images = page.getByRole("group", { name: "附上截图（选填）" });
  await expect(images).toContainText("最多 3 张");
  const choose = images.getByLabel("选择截图");

  await choose.setInputFiles({ name: "chat.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") });
  await expect(page.getByRole("main").getByRole("alert")).toHaveText("只能上传 JPG、PNG 或 WebP 格式的图片");

  const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 200, height: 120 } });
  await choose.setInputFiles({ name: "聊天截图.png", mimeType: "image/png", buffer: shot });
  await expect(images.getByText("聊天截图.png", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await images.getByRole("button", { name: "移除 聊天截图.png" }).click();
  await expect(images.getByText("聊天截图.png", { exact: true })).toHaveCount(0);
  await choose.setInputFiles({ name: "聊天截图.png", mimeType: "image/png", buffer: shot });

  await page.getByLabel("收押金 / 介绍费").check();
  await page.getByRole("button", { name: "提交举报" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("谢谢你的举报");

  // The screenshots' address answers moderators only (/admin's 举报 shows them, line B).
  expect((await request.get("/api/report-evidence/1")).status()).toBe(404);
});
