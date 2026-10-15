import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// A26: reminders when a chat message asks for fees, sells visas or picks people by ethnicity.
test("a received message asking for a deposit gets a reminder and a report link; my own draft gets a hint", async ({
  page,
}, testInfo) => {
  const email = `compliance.${testInfo.project.name}.${Date.now()}@example.com`;
  await page.addInitScript((address) => {
    if (!localStorage.getItem("zhaogong:session"))
      localStorage.setItem(
        "zhaogong:session",
        JSON.stringify({ email: address, activeRole: "seeker", signedInAt: "2026-10-15T00:00:00Z" }),
      );
  }, email);
  await page.goto("/messages?conversation=north-tea");
  const log = page.getByRole("log");
  await expect(log.getByRole("note", { name: "合规提醒" })).toHaveCount(0); // the demo messages are fine

  // The employer's next message, as another tab would add it.
  await page.evaluate((address) => {
    const key = "zhaogong:chat-demo";
    const scope = JSON.stringify([address, "seeker", null]);
    const stored = JSON.parse(localStorage.getItem(key) ?? '{"version":2,"identities":{}}');
    const record = stored.identities[scope] ?? { added: {}, readAt: {}, extra: [], exchanges: {}, reports: [] };
    record.added["north-tea"] = [
      ...(record.added["north-tea"] ?? []),
      { from: "them", text: "入职前要先交 200 元押金", time: "刚刚", sentAt: new Date().toISOString() },
    ];
    stored.identities[scope] = record;
    localStorage.setItem(key, JSON.stringify(stored));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  }, email);
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
