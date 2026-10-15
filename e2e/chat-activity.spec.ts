import { expect, test } from "@playwright/test";
import { chatMenuItem } from "./helpers";
import AxeBuilder from "@axe-core/playwright";
import { signUpEmployer } from "./employer/helpers";

test("seeker sees employer activity and receipts only change when the counterpart reads", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("zhaogong:session"))
      localStorage.setItem(
        "zhaogong:session",
        JSON.stringify({ email: "activity-seeker@example.com", activeRole: "seeker", signedInAt: "2026-10-13" }),
      );
  });
  await page.goto("/messages?conversation=north-tea");
  const activity = page.getByLabel("沟通状态", { exact: true });
  await expect(activity).toContainText(/对方约 \d+ 分钟前在线/);
  await expect(activity).toContainText(/雇主今日已回复 \d+ 位求职者/);
  await expect(activity).toContainText("演示状态");
  const log = page.getByRole("log");
  await expect(log.getByLabel("对方已读", { exact: true })).toHaveCount(1);
  await expect(log.getByLabel("我已读", { exact: true })).toHaveCount(2);
  await page.getByLabel("输入消息").fill("请查看我的新消息");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(log.getByLabel("对方未读", { exact: true })).toHaveCount(1);
  await page.reload();
  await expect(log.getByLabel("对方未读", { exact: true })).toHaveCount(1);
  await page.evaluate(() => {
    const key = "zhaogong:chat-demo";
    const stored = JSON.parse(localStorage.getItem(key)!);
    const scope = JSON.stringify(["activity-seeker@example.com", "seeker", null]);
    // Only messages added after the demo thread are stored (A23); a reply from another tab is added there.
    const added = stored.identities[scope].added["north-tea"];
    added.at(-1).readAt = new Date().toISOString();
    added.push({ from: "them", text: "新的回复已送达", time: "刚刚", sentAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(stored));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });
  await expect(log.getByLabel("对方已读", { exact: true })).toHaveCount(2);
  await expect(log.getByLabel("我已读", { exact: true })).toHaveCount(3);
  await expect(log.getByLabel("对方未读", { exact: true })).toHaveCount(0);
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("seeker-chat-activity.png"), fullPage: true });
  await (await chatMenuItem(page, "雇主主页")).click();
  await expect(page.getByLabel("雇主沟通情况", { exact: true })).toContainText(/今日已回复 \d+ 位求职者/);
});

test("employer sees candidate activity and counts distinct daily replies rather than messages or invitations", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo, "/messages?conversation=candidate-lin");
  const activity = page.getByLabel("沟通状态", { exact: true });
  await expect(activity).toContainText(/对方约 \d+ 分钟前在线/);
  await expect(activity).toContainText("你今日已回复 0 位求职者");
  const send = async (text: string) => {
    await page.getByLabel("输入消息").fill(text);
    await page.getByRole("button", { name: "发送", exact: true }).click();
  };
  await send("今天的面试安排");
  await expect(activity).toContainText("你今日已回复 1 位求职者");
  await send("再补充一条消息");
  await expect(activity).toContainText("你今日已回复 1 位求职者");
  await expect(page.getByRole("log").getByLabel("对方未读", { exact: true })).toHaveCount(2);
  await page.reload();
  await expect(activity).toContainText("你今日已回复 1 位求职者");
  await page.goto("/messages?conversation=candidate-chen");
  await send("收到你的应聘资料");
  await expect(activity).toContainText("你今日已回复 2 位求职者");
  await page.screenshot({ path: testInfo.outputPath("employer-chat-activity.png"), fullPage: true });
  await page
    .getByRole("banner")
    .getByRole("button", { name: /^账号菜单/ })
    .click();
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await page.goto("/messages?conversation=north-tea");
  await expect(activity).toContainText("雇主今日已回复");
  await expect(page.getByRole("log")).not.toContainText("今天的面试安排");
});
