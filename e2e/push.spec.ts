import { createECDH, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { chatAboutJob, fillSignInCode, freshEmail, signIn } from "./helpers";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

// C5_PUSH_TEST=1 is a test-runner marker, not an application setting. See docs/web-push.md for two runs.
const configured = process.env.C5_PUSH_TEST === "1";
async function browserPush(page: Page, permission: "default" | "granted" | "denied" = "default") {
  const key = createECDH("prime256v1");
  key.generateKeys();
  const keys = { p256dh: key.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") };
  const prefix = randomBytes(10).toString("hex");
  await page.addInitScript(
    ({ keys, prefix, permission }) => {
      const store = "c5-test-push-subscription";
      let current = (sessionStorage.getItem("c5-test-permission") || permission) as NotificationPermission;
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: class {
          static get permission() {
            return current;
          }
          static async requestPermission() {
            sessionStorage.setItem(
              "c5-test-prompts",
              String(Number(sessionStorage.getItem("c5-test-prompts") || 0) + 1),
            );
            const answer = sessionStorage.getItem("c5-test-answer") || "granted";
            current = answer as NotificationPermission;
            sessionStorage.setItem("c5-test-permission", current);
            return current;
          }
        },
      });
      Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
      const getSubscription = () => {
        const endpoint = sessionStorage.getItem(store);
        return endpoint
          ? {
              endpoint,
              toJSON: () => ({ endpoint, keys }),
              unsubscribe: async () => {
                sessionStorage.removeItem(store);
                return true;
              },
            }
          : null;
      };
      const registration = {
        active: {},
        pushManager: {
          getSubscription: async () => getSubscription(),
          subscribe: async () => {
            if (sessionStorage.getItem("c5-test-hold-subscribe") === "1") {
              sessionStorage.removeItem("c5-test-hold-subscribe");
              sessionStorage.setItem("c5-test-subscribe-waiting", "1");
              await new Promise<void>((resolve) =>
                window.addEventListener("c5-test-release-subscribe", () => resolve(), { once: true }),
              );
              sessionStorage.removeItem("c5-test-subscribe-waiting");
            }
            const n = Number(sessionStorage.getItem("c5-test-sequence") || 0) + 1;
            sessionStorage.setItem("c5-test-sequence", String(n));
            sessionStorage.setItem(store, `https://fcm.googleapis.com/fcm/send/${prefix}-${n}`);
            return getSubscription();
          },
        },
      };
      Object.defineProperty(navigator.serviceWorker, "getRegistration", {
        configurable: true,
        value: async () => (sessionStorage.getItem(store) ? registration : undefined),
      });
      Object.defineProperty(navigator.serviceWorker, "register", {
        configurable: true,
        value: async () => registration,
      });
    },
    { keys, prefix, permission },
  );
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
  expect(
    await page.evaluate(async () => {
      await navigator.serviceWorker.register("/api/push/worker", { scope: "/" });
      const worker = await navigator.serviceWorker.ready;
      return new URL(worker.active!.scriptURL).pathname;
    }),
  ).toBe("/api/push/worker");
});

test("push: cancelled permission stays off; explicit enable, refresh and cancel persist through real server actions", async ({
  page,
}) => {
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
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "PushManager");
  });
  await signIn(page, "/account", freshEmail("push.unsupported"));
  await expect(
    page.getByText("此浏览器暂不支持网页推送。iPhone／iPad请先添加到主屏幕，再从主屏幕打开。", { exact: true }),
  ).toBeVisible();
  await expect(enable(page)).toBeDisabled();
});

test("push: missing origin coordination refuses enable but still stops this login's server alerts", async ({
  page,
}) => {
  await browserPush(page, "granted");
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: undefined });
  });
  await signIn(page, "/account", freshEmail("push.no-locks"));
  await expect(
    page.getByText("此浏览器无法安全协调多个页面的推送设置，暂不能开启。你仍可关闭本次登录的站点提醒。", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(enable(page)).toBeDisabled();
  await expect(disable(page)).toBeEnabled();
  await disable(page).click();
  await expect(
    page.getByText("已停止本次登录的站点推送。请到浏览器或系统设置中关闭通知，完成此浏览器的取消。", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("c5-test-prompts"))).toBeNull();
});

test("push: a delayed old identity is rolled back before the remounted identity can enable", async ({ page }, info) => {
  test.skip(!configured, "Requires temporary local VAPID settings.");
  await browserPush(page, "granted");
  await signUpEmployer(page, info, "/account");
  await expect(disabled(page)).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem("c5-test-hold-subscribe", "1"));
  await enable(page).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("c5-test-subscribe-waiting"))).toBe("1");
  await page.evaluate(() => {
    (window as unknown as { c5Document: string }).c5Document = "held-subscription";
  });
  await page.getByRole("button", { name: "切换为求职者", exact: true }).click();
  await expect(page).toHaveURL("/workspace");
  // Browser Back follows Next's SPA history on both layouts; reloading would terminate the outstanding operation.
  await page.goBack();
  await expect(page).toHaveURL("/account");
  expect(await page.evaluate(() => (window as unknown as { c5Document: string }).c5Document)).toBe("held-subscription");
  await expect(page.getByText("正在检查提醒设置…", { exact: true })).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event("c5-test-release-subscribe")));
  await expect(disabled(page)).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("c5-test-push-subscription"))).toBeNull();
  await enable(page).click();
  await expect(enabled(page)).toBeVisible();
  await page.reload();
  await expect(enabled(page)).toBeVisible();
  await disable(page).click();
});

test("push: account identity switches pause the old subscription, and a new login can enable a fresh endpoint", async ({
  page,
}, info) => {
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

test("push: real click routes retain sign-in return targets, authorize chat owners and isolate identities", async ({
  page,
  browser,
}, info) => {
  test.slow();
  await signUpEmployer(page, info);
  const jobId = (await publishJob(page, uniqueTitle("推送跳转服务员", info)))!;
  const seekerContext = await browser.newContext({ ...info.project.use });
  const otherContext = await browser.newContext({ ...info.project.use });
  const visitorContext = await browser.newContext({ ...info.project.use });
  try {
    const seeker = await seekerContext.newPage(),
      other = await otherContext.newPage(),
      visitor = await visitorContext.newPage();
    const email = freshEmail("push.click.owner");
    const privateText = `只给这段聊天的文字${Date.now()}`;
    await signIn(seeker, `/jobs/${jobId}`, email);
    await chatAboutJob(seeker, jobId, privateText);
    const conversation = new URL(seeker.url()).searchParams.get("conversation")!;
    const seekerHref = `/api/push/open?role=seeker&conversation=${encodeURIComponent(conversation)}`;
    await seeker.goto(seekerHref);
    await expect(seeker).toHaveURL(
      (url) => url.pathname === "/messages" && url.searchParams.get("conversation") === conversation,
    );
    await expect(seeker.getByRole("log", { name: "消息记录" })).toContainText(privateText);

    // Correct role, different account: a real database ownership check cannot disclose the target chat.
    await signIn(other, "/account", freshEmail("push.click.other"));
    await other.goto(seekerHref);
    await expect(other).toHaveURL("/messages");
    await expect(other.getByRole("main")).not.toContainText(privateText);

    // The business is signed in as employer; a seeker notification cannot switch it by GET.
    await page.goto(seekerHref);
    await expect(page).toHaveURL("/account?pushRole=seeker");
    await expect(page.getByRole("button", { name: "切换为求职者", exact: true })).toBeVisible();
    await page.goto("/messages");
    await page
      .getByRole("complementary", { name: "聊天列表" })
      .getByRole("button")
      .filter({ hasText: privateText })
      .click();
    await expect(page).toHaveURL((url) => url.pathname === "/messages" && !!url.searchParams.get("conversation"));
    const employerConversation = new URL(page.url()).searchParams.get("conversation")!;
    await page.goto(`/api/push/open?role=employer&conversation=${encodeURIComponent(employerConversation)}`);
    await expect(page).toHaveURL(
      (url) => url.pathname === "/messages" && url.searchParams.get("conversation") === employerConversation,
    );
    await expect(page.getByRole("log", { name: "消息记录" })).toContainText(privateText);

    // Real signed-out click -> login -> same route checks the newly authenticated owner before opening the chat.
    await visitor.goto(seekerHref);
    await expect(visitor).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("next") === seekerHref);
    await visitor.getByLabel("邮箱", { exact: true }).fill(email);
    await visitor.getByRole("button", { name: "获取验证码" }).click();
    await fillSignInCode(visitor);
    await visitor.getByRole("button", { name: "登录", exact: true }).click();
    await expect(visitor).toHaveURL(
      (url) => url.pathname === "/messages" && url.searchParams.get("conversation") === conversation,
    );
    await expect(visitor.getByRole("log", { name: "消息记录" })).toContainText(privateText);
  } finally {
    await seekerContext.close();
    await otherContext.close();
    await visitorContext.close();
  }
});
