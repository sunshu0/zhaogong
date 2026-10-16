import { expect, test, type Browser, type Page, type Route } from "@playwright/test";
import { expectProfileSaved, freshEmail, signIn } from "./helpers";

// #104: 我的主页 belongs to the account. The second device is a new browser context with the first one's session
// cookie only (a sign-in code can be asked for once a minute per email), so nothing of the page comes along with it.

async function secondDevice(browser: Browser, first: Page): Promise<Page> {
  const context = await browser.newContext({ viewport: first.viewportSize() ?? undefined });
  await context.addCookies(await first.context().cookies());
  return context.newPage();
}

/** Puts a page into this browser's own copy, as one filled in here before signing in to this account would be. */
async function pageOnThisDevice(page: Page, email: string, changes: Record<string, string>) {
  await page.goto("/");
  await page.evaluate(
    ([email, changes]) => {
      const scope = JSON.stringify([email, "seeker", null]);
      localStorage.setItem(
        "zhaogong:profiles-by-identity",
        JSON.stringify({ version: 2, identities: { [scope]: changes } }),
      );
    },
    [email, changes] as const,
  );
}

test("filled in on one device, there on another after signing in", async ({ page, browser }) => {
  await signIn(page, "/profile", freshEmail("profile.server"));
  await expect(page.getByText("改动会自动保存到你的账号。")).toBeVisible();
  await page.getByLabel("可上班时间").fill("周末和晚上");
  await expectProfileSaved(page);

  const other = await secondDevice(browser, page);
  await other.goto("/profile");
  await expect(other.getByLabel("可上班时间")).toHaveValue("周末和晚上");

  // A change there shows here on the next visit.
  await other.getByLabel("可上班时间").fill("只有周末");
  await expectProfileSaved(other);
  await page.reload();
  await expect(page.getByLabel("可上班时间")).toHaveValue("只有周末");
  await other.context().close();
});

test("when this device has a different page, the person picks which to keep", async ({ page, browser }) => {
  const email = await signIn(page, "/profile", freshEmail("profile.choice"));
  await page.getByLabel("可上班时间").fill("周末和晚上");
  await expectProfileSaved(page);

  // The account's page wins: this device's copy is replaced.
  const second = await secondDevice(browser, page);
  await pageOnThisDevice(second, email, { availability: "工作日白天" });
  await second.goto("/profile");
  const choice = second.getByRole("region", { name: "这台设备上的主页和你账号里的不一样" });
  await expect(choice).toBeVisible();
  await expect(second.getByText("先在上面选留哪一份。选好之前，改动只存在这台设备上。")).toBeVisible();
  await choice.getByRole("button", { name: "用账号里的" }).click();
  await expect(choice).toHaveCount(0);
  await expect(second.getByLabel("可上班时间")).toHaveValue("周末和晚上");
  await second.context().close();

  // This device's page wins: it goes to the account, and the first device shows it next time.
  const third = await secondDevice(browser, page);
  await pageOnThisDevice(third, email, { availability: "工作日白天" });
  await third.goto("/profile");
  await third.getByRole("button", { name: "用这台设备上的" }).click();
  await expectProfileSaved(third);
  await expect(third.getByLabel("可上班时间")).toHaveValue("工作日白天");
  await third.context().close();

  await page.reload();
  await expect(page.getByLabel("可上班时间")).toHaveValue("工作日白天");
});

test("without the server a change stays on this device, says so, and goes to the account with the next one", async ({
  page,
  browser,
}) => {
  await signIn(page, "/profile", freshEmail("profile.offline"));
  // Server Functions are POSTs to the page; the first save is lost on the way.
  const lost = (route: Route) => (route.request().method() === "POST" ? route.abort() : route.fallback());
  await page.route("**/profile", lost);
  await page.getByLabel("可上班时间").fill("周末");
  await expect(page.getByText(/^没连上服务器：改动先存在这台设备上/)).toBeVisible();
  await page.unroute("**/profile", lost);

  await page.getByLabel("期望时薪（NZ$ / 小时起）").fill("26");
  await expectProfileSaved(page);
  const other = await secondDevice(browser, page);
  await other.goto("/profile");
  await expect(other.getByLabel("可上班时间")).toHaveValue("周末");
  await expect(other.getByLabel("期望时薪（NZ$ / 小时起）")).toHaveValue("26");
  await other.context().close();
});
