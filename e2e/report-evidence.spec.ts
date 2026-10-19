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
