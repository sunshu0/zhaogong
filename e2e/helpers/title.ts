import { expect, type Page } from "@playwright/test";

// #367: after an in-app move the page's <title> comes on its own, about 300 ms after the content (Next 16 streams
// generateMetadata). axe in between finds no <title> and reports document-title now and then (employer-public, 10-23;
// #364). Every spec that runs axe waits for the title first.

/**
 * Waits until the page has its <title>: any title that is not blank, or `title` when the spec knows it. An empty title
 * for good still fails here.
 */
export async function waitForTitle(page: Page, title: string | RegExp = /\S/): Promise<void> {
  await expect(page, "<title> before axe").toHaveTitle(title);
}
