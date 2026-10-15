import { expect, test } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";

// #10: a message is kept even when the page is left before its request reaches the server, and only once.
test("a message sent just before leaving the page reaches the server on the next load, once", async ({ page }) => {
  await signIn(page, "/messages?conversation=north-tea", freshEmail("outbox"));
  const log = page.getByRole("log");
  await expect(log).toBeVisible();
  // One message the server has, so the next load reads the server's records (a browser with records the server
  // lacks entirely would hand them over as from before #10).
  const saved = page.waitForResponse((r) => !!r.request().postData()?.includes("第一条"));
  await page.getByLabel("输入消息").fill("第一条");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await saved;

  // Server Function calls fail from here, as when the page is left before they go out; then the page loads again.
  await page.route("**/*", async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) return route.abort();
    await route.continue();
  });
  await page.getByLabel("输入消息").fill("离开页面前发出的消息");
  await page.getByRole("button", { name: "发送", exact: true }).click();
  await expect(log).toContainText("离开页面前发出的消息");
  await page.unrouteAll({ behavior: "wait" });

  await page.reload();
  await expect(log.getByText("离开页面前发出的消息", { exact: true })).toHaveCount(1);
  // Another load reads it from the server, still once.
  await page.evaluate(() => localStorage.removeItem("zhaogong:chat-demo"));
  await page.reload();
  await expect(log.getByText("离开页面前发出的消息", { exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("zhaogong:chat-outbox"))).toBeNull();
});
