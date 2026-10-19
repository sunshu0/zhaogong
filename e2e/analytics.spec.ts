import { expect, test, type Page } from "@playwright/test";

// #313 (ADR 0025 §6): a build without NEXT_PUBLIC_CLARITY_ID (development, every browser-test build but the consent
// one) never asks and never loads Microsoft Clarity. analytics-consent.spec.ts tests the prompt in a build with one.
test.skip(!!process.env.NEXT_PUBLIC_CLARITY_ID, "This build has Clarity set up: analytics-consent.spec.ts covers it");

async function clarityRequests(page: Page, paths: string[]) {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("clarity.ms")) seen.push(request.url());
  });
  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("load");
  }
  return seen;
}

test("no Clarity and no consent prompt where Clarity is not set up", async ({ page }) => {
  expect(await clarityRequests(page, ["/", "/jobs", "/jobs/j1", "/professional", "/internships"])).toEqual([]);
  await expect(page.locator("html[data-consent-checked]")).toHaveCount(1); // Analytics has decided
  await expect(page.getByRole("region", { name: "统计设置" })).toHaveCount(0);
  await expect(page.locator("footer").getByRole("button", { name: "统计设置" })).toHaveCount(0);
});
