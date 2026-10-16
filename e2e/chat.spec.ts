import { expect, test } from "@playwright/test";
import { chatEntry, counterpartActs, freshEmail, signIn } from "./helpers";
import AxeBuilder from "@axe-core/playwright";

test("chat is prominent, unread counts sync and the composer stays visible", async ({ page }, testInfo) => {
  await signIn(page, "/jobs", freshEmail("demo.chat"));
  const entry = chatEntry(page);
  await expect(entry).toHaveAttribute("title", "聊天，3 条未读消息");
  await entry.click();
  const board = page.locator("[data-chat-workspace]");
  await expect(board).toBeVisible();
  const width = (await board.boundingBox())!.width;
  if (testInfo.project.name === "desktop") expect(width).toBeGreaterThan(1000);
  await page
    .getByRole("complementary", { name: "聊天列表" })
    .getByRole("button", { name: /北岸早茶酒家/ })
    .click();
  await expect(entry).toHaveAttribute("title", "聊天，1 条未读消息");
  const input = page.getByLabel("输入消息");
  await expect(input).toBeVisible();
  await input.fill("你好，我今天下午可以面谈。");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(page.getByRole("log")).toContainText("你好，我今天下午可以面谈。");
  if (testInfo.project.name === "desktop") {
    const before = (await input.boundingBox())!;
    for (let i = 0; i < 12; i++) {
      await input.fill(`补充消息 ${i}`);
      await page.getByRole("button", { name: "发送", exact: true }).click();
    }
    expect((await input.boundingBox())!.y).toBe(before.y);
    expect(before.y + before.height).toBeLessThan(page.viewportSize()!.height);
  }
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `D:/dev/zhaogong-shots/chat-expanded-${testInfo.project.name}.png`, fullPage: true });
  await page.goto("/profile");
  await expect(entry).toHaveAttribute("title", "聊天，1 条未读消息");
  await page.reload();
  await expect(entry).toHaveAttribute("title", "聊天，1 条未读消息");
  await entry.click();
  await page
    .getByRole("complementary", { name: "聊天列表" })
    .getByRole("button", { name: /北岸早茶酒家/ })
    .click();
  await expect(page.getByRole("log")).toContainText("你好，我今天下午可以面谈。");
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "返回会话列表" }).click();
  await page
    .getByRole("complementary", { name: "聊天列表" })
    .getByRole("button", { name: /Mt Eden/ })
    .click();
  await expect(entry).toHaveAttribute("title", "聊天");
  // A new message arrives from the employer (#10: written on the server, shown after a reload).
  await page.goto("/jobs");
  await counterpartActs(page, "north-tea", { reply: "新的回复" });
  await expect(entry).toHaveAttribute("title", "聊天，1 条未读消息");
  // A different account must start with its own demo unread state.
  await page.evaluate(() => {
    const key = "zhaogong:session";
    localStorage.setItem(
      key,
      JSON.stringify({ email: "another@example.com", activeRole: "seeker", signedInAt: "2026-10-13T00:00:00.000Z" }),
    );
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });
  await expect(entry).toHaveAttribute("title", "聊天，3 条未读消息");
});
