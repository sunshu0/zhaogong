import { createECDH, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";
import { signUpEmployer } from "./employer/helpers";

// C5_PUSH_TEST=1 is a test-runner marker, not an application setting. See docs/web-push.md for two runs.
const configured = process.env.C5_PUSH_TEST === "1";
async function browserPush(page: Page, permission: "default" | "granted" | "denied" = "default") {
  const key = createECDH("prime256v1"); key.generateKeys();
  const keys = { p256dh: key.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
  const prefix = randomBytes(10).toString("hex");
  await page.addInitScript(({ keys, prefix, permission }) => {
    const store = "c5-test-push-subscription";
    let current = (sessionStorage.getItem("c5-test-permission") || permission) as NotificationPermission;
    Object.defineProperty(window, "Notification", { configurable: true, value: class {
      static get permission() { return current; }
      static async requestPermission() {
        sessionStorage.setItem("c5-test-prompts", String(Number(sessionStorage.getItem("c5-test-prompts") || 0) + 1));
        const answer = sessionStorage.getItem("c5-test-answer") || "granted";
        current = answer as NotificationPermission;
        sessionStorage.setItem("c5-test-permission", current);
        return current;
      }
    } });
    Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
    const getSubscription = () => {
      const endpoint = sessionStorage.getItem(store);
      return endpoint ? {
        endpoint, toJSON: () => ({ endpoint, keys }),
        unsubscribe: async () => { sessionStorage.removeItem(store); return true; },
      } : null;
    };
    const registration = { active: {}, pushManager: {
      getSubscription: async () => getSubscription(),
      subscribe: async () => {
        const n = Number(sessionStorage.getItem("c5-test-sequence") || 0) + 1;
        sessionStorage.setItem("c5-test-sequence", String(n));
        sessionStorage.setItem(store, `https://fcm.googleapis.com/fcm/send/${prefix}-${n}`);
        return getSubscription();
      },
    } };
    Object.defineProperty(navigator.serviceWorker, "getRegistration", { configurable: true, value: async () => sessionStorage.getItem(store) ? registration : undefined });
    Object.defineProperty(navigator.serviceWorker, "register", { configurable: true, value: async () => registration });
  }, { keys, prefix, permission });
}
const enabled = (page: Page) => page.getByText("此浏览器已开启当前身份的提醒。", { exact: true });
const disabled = (page: Page) => page.getByText("此浏览器尚未开启当前身份的提醒。", { exact: true });
const enable = (page: Page) => page.getByRole("button", { name: "开启当前身份的提醒", exact: true });
const disable = (page: Page) => page.getByRole("button", { name: "关闭此浏览器提醒", exact: true });

test("push: missing keys shows unavailable without asking for permission", async ({ page }) => {
  test.skip(configured, "This case uses a server with no VAPID settings.");
  await browserPush(page);
  await signIn(page, "/account", freshEmail("push.no-config"));
  await expect(page.getByText("网页提醒暂未开放，你仍可在站内查看消息。", { exact: true })).toBeVisible();
  await expect(enable(page)).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem("c5-test-prompts"))).toBeNull();
});

test("push: service worker is real JavaScript with root scope and no private-page caching", async ({ page }) => {
  await page.goto("/jobs");
  const response = await page.request.get("/api/push/worker");
  expect(response.headers()["content-type"]).toContain("javascript");
  expect(response.headers()["service-worker-allowed"]).toBe("/");
  expect(response.headers()["cache-control"]).toContain("no-store");
  const script = await response.text();
  expect(script).not.toContain("addEventListener('fetch'");
  expect(await page.evaluate(async () => {
    await navigator.serviceWorker.register("/api/push/worker", { scope: "/" });
    const worker = await navigator.serviceWorker.ready;
    return new URL(worker.active!.scriptURL).pathname;
  })).toBe("/api/push/worker");
});

test("push: cancelled permission stays off; explicit enable, refresh and cancel persist through real server actions", async ({ page }) => {
  test.skip(!configured, "Requires temporary local VAPID settings; no vendor sends in a ZG_E2E build.");
  await browserPush(page, "default");
  await signIn(page, "/account", freshEmail("push.flow"));
  await expect(disabled(page)).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("c5-test-prompts"))).toBeNull();
  await page.evaluate(() => sessionStorage.setItem("c5-test-answer", "default"));
  await enable(page).click();
  await expect(disabled(page)).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("c5-test-push-subscription"))).toBeNull();
  await page.evaluate(() => sessionStorage.setItem("c5-test-answer", "granted"));
  await enable(page).click();
  await expect(enabled(page)).toBeVisible();
  // Reload retains browser permission/subscription; server ownership remains real.
  await page.reload();
  await expect(enabled(page)).toBeVisible();
  await disable(page).click();
  await expect(disabled(page)).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("c5-test-push-subscription"))).toBeNull();
  await page.reload();
  await expect(disabled(page)).toBeVisible();
});

test("push: blocked permission is honest and never claims the subscription was deleted", async ({ page }) => {
  await browserPush(page, "denied");
  await signIn(page, "/account", freshEmail("push.denied"));
  await expect(page.getByText("系统已禁止通知。请在浏览器或系统设置中允许后重试。", { exact: true })).toBeVisible();
  await expect(enable(page)).toBeDisabled();
  expect(await page.evaluate(() => sessionStorage.getItem("c5-test-prompts"))).toBeNull();
});

test("push: unsupported browsers get a Home Screen hint without a permission prompt", async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(window, "PushManager"); });
  await signIn(page, "/account", freshEmail("push.unsupported"));
  await expect(page.getByText("此浏览器暂不支持网页推送。iPhone／iPad请先添加到主屏幕，再从主屏幕打开。", { exact: true })).toBeVisible();
  await expect(enable(page)).toBeDisabled();
});

test("push: account identity switches pause the old subscription, and a new login can enable a fresh endpoint", async ({ page }, info) => {
  test.skip(!configured, "Requires temporary local VAPID settings.");
  await browserPush(page, "granted");
  await signUpEmployer(page, info, "/account");
  await expect(disabled(page)).toBeVisible();
  await enable(page).click();
  await expect(enabled(page)).toBeVisible();
  const first = await page.evaluate(() => sessionStorage.getItem("c5-test-push-subscription"));
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await expect(page).toHaveURL("/workspace");
  await page.goto("/account");
  await expect(disabled(page)).toBeVisible();
  await page.getByRole("button", { name: /^切换为雇主/ }).click();
  await expect(page).toHaveURL("/workspace");
  await page.goto("/account");
  await expect(enabled(page)).toBeVisible();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL("/jobs");
  await signIn(page, "/account", freshEmail("push.new-login"));
  await expect(disabled(page)).toBeVisible();
  await enable(page).click();
  await expect(enabled(page)).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("c5-test-push-subscription"))).not.toBe(first);
  await disable(page).click();
  await expect(disabled(page)).toBeVisible();
});
