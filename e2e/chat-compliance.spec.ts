import { expect, test } from "@playwright/test";
import { counterpartActs, freshEmail, signIn } from "./helpers";
import AxeBuilder from "@axe-core/playwright";

// A26: reminders when a chat message asks for fees, sells visas or picks people by ethnicity.
test("a received message asking for a deposit gets a reminder and a report link; my own draft gets a hint", async ({
  page,
}, testInfo) => {
  await signIn(page, "/messages?conversation=north-tea", freshEmail("demo.compliance"));
  const log = page.getByRole("log");
  await expect(log.getByRole("note", { name: "合规提醒" })).toHaveCount(0); // the demo messages are fine

  // The employer's next message (#10: on the server).
  await counterpartActs(page, "north-tea", { reply: "入职前要先交 200 元押金" });
  const note = log.getByRole("note", { name: "合规提醒" });
  await expect(note).toHaveCount(1);
  await expect(note).toContainText("找工不允许向求职者收取押金或任何费用。请谨慎，不要先付钱；可以举报。");
  await page.screenshot({ path: testInfo.outputPath("chat-reminder.png"), fullPage: true });
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);

  await note.getByRole("button", { name: "举报这条消息" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("举报原因", { exact: true })).toHaveValue("fees");
  await expect(dialog).toContainText("入职前要先交 200 元押金");
  await dialog.getByRole("button", { name: "提交举报", exact: true }).click();
  await expect(dialog).toContainText("举报已记录");
  await dialog.getByRole("button", { name: "关闭", exact: true }).click();

  const draft = page.getByLabel("输入消息");
  await draft.fill("我可以先交押金吗");
  await expect(page.getByRole("status").filter({ hasText: "这条消息提到「押金」" })).toBeVisible();
  await expect(page.getByRole("button", { name: "发送", exact: true })).toBeEnabled(); // a hint, not a block
  await draft.fill("我们不收押金");
  await expect(page.getByText("这条消息提到", { exact: false })).toHaveCount(0);
});
