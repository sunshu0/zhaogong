import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { freshEmail, signIn } from "./helpers";
import { signUpEmployer } from "./employer/helpers";
import { waitForTitle } from "./helpers/title";

// T1 (#397, ADR 0042): on a phone an open conversation fills the screen like a chat app — no site header, footer or
// bottom bar; the back key returns to the list; the box grows with what is typed; the keyboard does not cover it.
test.use({ reducedMotion: "reduce" });

const PHONE = { width: 375, height: 667 };

const list = (page: Page) => page.getByRole("complementary", { name: "聊天列表" });
const bottomBar = (page: Page) => page.getByRole("navigation", { name: "底部导航" });
const box = async (locator: ReturnType<Page["locator"]>) => (await locator.boundingBox())!;

/** The open conversation fills the phone's screen: nothing of the site around it, and the messages get room. */
async function expectFullscreen(page: Page, person: RegExp) {
  await expect(page.getByRole("region", { name: person })).toBeVisible();
  await expect(bottomBar(page)).toBeHidden();
  await expect(page.getByRole("banner")).toBeHidden();
  await expect(page.locator("[data-site-footer]")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toBeHidden();
  await expect(list(page)).toBeHidden();
  const board = await box(page.locator("[data-chat-workspace]"));
  expect(board.y).toBe(0);
  expect(Math.round(board.height)).toBe(PHONE.height);
  // With the keyboard down, the messages take at least half the screen.
  expect((await box(page.getByRole("log", { name: "消息记录" }))).height).toBeGreaterThanOrEqual(PHONE.height / 2);
  // The keyboard shrinks the page here (Chrome on Android); the layout's other settings are still there.
  const viewport = page.locator('meta[name="viewport"]');
  await expect(viewport).toHaveAttribute("content", /interactive-widget=resizes-content/);
  await expect(viewport).toHaveAttribute("content", /width=device-width/);
}

/** The box starts at one line, grows with each line typed and stops at about five, then scrolls inside. */
async function expectGrowingBox(page: Page) {
  const input = page.getByLabel("输入消息");
  const send = page.getByRole("button", { name: "发送", exact: true });
  const one = (await box(input)).height;
  expect(one).toBeLessThanOrEqual(48);
  await input.fill("第一行\n第二行\n第三行");
  const three = (await box(input)).height;
  expect(three).toBeGreaterThanOrEqual(one + 40);
  // ＋, the box and 发送 line up at the bottom.
  const bottom = (await box(input)).y + three;
  expect(Math.abs((await box(send)).y + (await box(send)).height - bottom)).toBeLessThanOrEqual(2);
  await input.fill(Array.from({ length: 10 }, (_, i) => `第 ${i + 1} 行`).join("\n"));
  expect((await box(input)).height).toBeLessThanOrEqual(146);
  expect(await input.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await input.fill("");
}

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "the full-screen chat is the phone's layout");
  test.use({ viewport: PHONE });

  test("job seeker: the conversation fills the screen, the back key returns to the list", async ({
    page,
  }, testInfo) => {
    await signIn(page, "/messages", freshEmail("demo.fullscreen"));
    await expect(bottomBar(page)).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await list(page)
      .getByRole("button", { name: /北岸早茶酒家/ })
      .click();
    await expect(page).toHaveURL("/messages?conversation=north-tea");
    await expectFullscreen(page, /北岸早茶酒家/);
    await expectGrowingBox(page);
    await waitForTitle(page);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual(
      [],
    );
    await page.screenshot({ path: testInfo.outputPath("seeker-fullscreen.png") });

    // The phone's back key closes the conversation and stays on /messages, with the site around the list again.
    await page.goBack();
    await expect(page).toHaveURL("/messages");
    await expect(list(page)).toBeVisible();
    await expect(bottomBar(page)).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();

    // ← in the conversation does the same; forward opens it again.
    await list(page)
      .getByRole("button", { name: /北岸早茶酒家/ })
      .click();
    await page.getByRole("button", { name: "返回会话列表", exact: true }).click();
    await expect(page).toHaveURL("/messages");
    await expect(list(page)).toBeVisible();
    await page.goForward();
    await expectFullscreen(page, /北岸早茶酒家/);

    // Straight to a conversation (a link from elsewhere), and after a reload: still open; ← goes to the list.
    await page.goto("/messages?conversation=mt-eden");
    await page.reload();
    await expectFullscreen(page, /Mt Eden/);
    await page.getByRole("button", { name: "返回会话列表", exact: true }).click();
    await expect(page).toHaveURL("/messages");
    await expect(list(page)).toBeVisible();
  });

  test("job seeker: with the keyboard up the box sits on it and the log stays at its end", async ({ page }) => {
    // Mt Eden's demo exchange card comes after the messages: the log's end is the card, not the newest message.
    await signIn(page, "/messages?conversation=mt-eden", freshEmail("demo.fullscreen-keys"));
    await expectFullscreen(page, /Mt Eden/);
    const input = page.getByLabel("输入消息");
    await input.fill("键盘弹出来以后还看得见");
    await page.getByRole("button", { name: "发送", exact: true }).click();
    const newest = page.getByRole("log", { name: "消息记录" }).getByText("键盘弹出来以后还看得见");
    await expect(newest).toBeVisible();
    // What a keyboard leaves of the screen (the page shrinks with it where interactive-widget is honoured).
    await page.setViewportSize({ width: PHONE.width, height: 360 });
    await input.focus();
    await expect.poll(async () => (await box(input)).y + (await box(input)).height).toBeLessThanOrEqual(360);
    const log = page.getByRole("log", { name: "消息记录" });
    await expect
      .poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight))
      .toBeLessThanOrEqual(2);
    await expect(log.locator(":scope > *").last()).toBeInViewport();
  });

  test("employer: the same full-screen conversation", async ({ page }, testInfo) => {
    await signUpEmployer(page, testInfo, "/messages", { demo: true });
    await expect(bottomBar(page)).toBeVisible();
    await list(page).getByRole("button", { name: /林晓/ }).click();
    await expect(page).toHaveURL("/messages?conversation=candidate-lin");
    await expectFullscreen(page, /林晓/);
    await expectGrowingBox(page);
    await waitForTitle(page);
    expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual(
      [],
    );
    await page.screenshot({ path: testInfo.outputPath("employer-fullscreen.png") });
    await page.goBack();
    await expect(page).toHaveURL("/messages");
    await expect(list(page)).toBeVisible();
    await expect(bottomBar(page)).toBeVisible();
  });
});

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "side by side from 1024 px");

  test("the list and the conversation stay side by side in the site, and a click adds no history entry", async ({
    page,
  }) => {
    await signIn(page, "/messages", freshEmail("demo.fullscreen-desk"));
    const entries = await page.evaluate(() => history.length);
    await list(page)
      .getByRole("button", { name: /北岸早茶酒家/ })
      .click();
    await expect(page).toHaveURL("/messages?conversation=north-tea");
    await list(page)
      .getByRole("button", { name: /Mt Eden/ })
      .click();
    await expect(page).toHaveURL("/messages?conversation=mt-eden");
    expect(await page.evaluate(() => history.length)).toBe(entries);
    await expect(list(page)).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.getByRole("heading", { name: "求职聊天", level: 1 })).toBeVisible();
    await expect(page.locator("[data-site-footer]")).toBeAttached();
    await expect(page.getByRole("button", { name: "返回会话列表", exact: true })).toBeHidden();
    // The desktop box keeps its three lines.
    const input = page.getByLabel("输入消息");
    expect(Math.round((await box(input)).height)).toBe(94);
    await page.reload();
    await expect(page.getByRole("region", { name: /Mt Eden/ })).toBeVisible();
  });
});
