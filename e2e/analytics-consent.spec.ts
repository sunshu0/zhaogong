import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// #313 (ADR 0025 §7): the consent prompt, in a test build made with NEXT_PUBLIC_CLARITY_ID (the #313 gate makes one
// for this spec alone). A test build asks but never loads Clarity, so these also check nothing goes to clarity.ms.
test.skip(!process.env.NEXT_PUBLIC_CLARITY_ID, "Needs a test build made with NEXT_PUBLIC_CLARITY_ID");
test.use({ reducedMotion: "reduce" });

const prompt = (page: Page) => page.getByRole("region", { name: "统计设置" });
/** The page has decided whether to ask (Analytics marks <html> once it has): only then is "no prompt" a result. */
const decided = (page: Page) => expect(page.locator("html[data-consent-checked]")).toHaveCount(1);
const consent = async (page: Page) =>
  (await page.context().cookies()).find((cookie) => cookie.name === "zg_consent")?.value;

function watchClarity(page: Page) {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("clarity.ms")) seen.push(request.url());
  });
  return seen;
}

test("asks once per page load until answered, at most three times, and the site works either way", async ({ page }) => {
  const clarity = watchClarity(page);
  await page.goto("/");
  await expect(prompt(page)).toContainText("Microsoft Clarity");
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
  // Asking by itself takes nothing from the keyboard.
  await expect(prompt(page).getByRole("button", { name: "同意" })).not.toBeFocused();

  await page.goto("/jobs");
  await expect(prompt(page)).toBeVisible();
  await page.goto("/jobs/j1");
  await expect(prompt(page)).toBeVisible();
  await page.goto("/jobs");
  await decided(page);
  await expect(prompt(page)).toHaveCount(0); // asked three times, no answer: it stops asking
  expect(await consent(page)).toBeUndefined();
  expect(clarity).toEqual([]);
});

test("同意 keeps the answer for a year; 统计设置 opens it again, and 不用了 turns it off", async ({ page }) => {
  const clarity = watchClarity(page);
  await page.goto("/jobs");
  await prompt(page).getByRole("button", { name: "同意" }).click();
  await expect(prompt(page)).toHaveCount(0);
  expect(await consent(page)).toBe("clarity");
  const cookie = (await page.context().cookies()).find((c) => c.name === "zg_consent")!;
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(360 * 24 * 3600);
  await page.reload();
  await decided(page);
  await expect(prompt(page)).toHaveCount(0);

  // The footer's 统计设置: the prompt again, with the keyboard on 同意 and what is set now.
  await page.locator("footer").getByRole("button", { name: "统计设置" }).click();
  await expect(prompt(page)).toContainText("现在：已同意。");
  await expect(prompt(page).getByRole("button", { name: "同意" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(prompt(page).getByRole("button", { name: "不用了" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.waitForLoadState("load"); // turning it off loads the page again
  expect(await consent(page)).toBe("none");
  await expect(prompt(page)).toHaveCount(0);
  // A test build never loads Clarity, agreed or not.
  expect(clarity).toEqual([]);
});
