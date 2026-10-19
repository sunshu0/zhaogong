import { expect, test, type Page } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";

// Reading and writing in the chat: each conversation keeps its own draft through a switch and a reload (#281),
// someone reading older messages is not pulled to the bottom by a reply (#282), and the tab's title counts the
// unread messages (#291).

const box = (page: Page) => page.getByLabel("输入消息");

test("a half-written message stays with its conversation through a switch and a reload, and goes once sent (#281)", async ({
  page,
}) => {
  await signIn(page, "/messages?conversation=north-tea", freshEmail("demo.drafts"));
  await expect(page.getByRole("log")).toBeVisible();
  await box(page).fill("北茶的草稿");

  await page.goto("/messages?conversation=mt-eden");
  await expect(box(page)).toHaveValue("");
  await box(page).fill("伊甸山的草稿");

  await page.goto("/messages?conversation=north-tea");
  await expect(box(page)).toHaveValue("北茶的草稿");
  await page.reload();
  await expect(box(page)).toHaveValue("北茶的草稿");

  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(box(page)).toHaveValue("");
  await expect(page.getByRole("log")).toContainText("北茶的草稿");
  await page.reload();
  await expect(box(page)).toHaveValue("");

  await page.goto("/messages?conversation=mt-eden");
  await expect(box(page)).toHaveValue("伊甸山的草稿");
});

test("reading older messages, a reply does not pull the log to the bottom; near the bottom it does (#282)", async ({
  page,
}) => {
  await signIn(page, "/messages?conversation=north-tea", freshEmail("demo.reading"));
  const log = page.getByRole("log");
  await expect(log).toBeVisible();
  // Enough messages for the log to scroll.
  for (let i = 1; i <= 6; i++) {
    await box(page).fill(`第 ${i} 条较长的消息：${"内容".repeat(40)}`);
    await page.getByRole("button", { name: "发送", exact: true }).click();
  }
  await expect(log).toContainText("第 6 条");
  await expect.poll(() => log.evaluate((el) => el.scrollHeight > el.clientHeight + 200)).toBe(true);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("zhaogong:chat-outbox"))).toBeNull();

  const refreshWith = async (reply: string) => {
    const response = await page.request.post("/api/dev/chat-reply", { data: { conversationId: "north-tea", reply } });
    expect(response.ok()).toBe(true);
    // The chat reads again when the page comes back to the front (useChatRefresh), as it does every 10 seconds.
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(log).toContainText(reply);
  };

  await log.evaluate((el) => {
    el.scrollTop = 0;
    el.dispatchEvent(new Event("scroll"));
  });
  await refreshWith("上面翻着的时候来的回复");
  expect(await log.evaluate((el) => el.scrollTop)).toBeLessThan(10);

  await log.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
    el.dispatchEvent(new Event("scroll"));
  });
  await refreshWith("在底部时来的回复");
  await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThan(10);
});

test("the tab's title counts the unread messages and drops the count once they are read (#291)", async ({ page }) => {
  await signIn(page, "/messages", freshEmail("demo.title"));
  // The demo account starts with 3 unread (chat.spec.ts).
  await expect(page).toHaveTitle(/^\(3\) /);
  await page.goto("/messages?conversation=north-tea");
  await expect(page.getByRole("log")).toBeVisible();
  await expect(page).not.toHaveTitle(/^\(3\) /);
  await page.goto("/jobs");
  await expect(page).not.toHaveTitle(/^\(\d+\) /);
});
