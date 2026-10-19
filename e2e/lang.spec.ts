import { expect, test } from "@playwright/test";

// Round 20 step 1 (#235, ADR 0023): the language plumbing. Pages are Chinese without the zg_lang cookie; with
// zg_lang=en the same address serves the English copy, <html lang> follows, and an address with a language goes
// back to the plain one. Page text is still Chinese until step 2: these checks look at the frame only.

test("an address with a language goes back to the plain one, for good", async ({ request }) => {
  const answer = await request.get("/en/jobs?q=x", { maxRedirects: 0 });
  expect(answer.status()).toBe(308);
  const to = new URL(answer.headers().location, "http://localhost");
  expect(`${to.pathname}${to.search}`).toBe("/jobs?q=x");
});

test("Chinese by default, English by the cookie at the same address, and the switch goes both ways", async ({
  page,
  baseURL,
}) => {
  await page.goto("/jobs");
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  const footer = page.locator("footer");
  await expect(footer).toContainText("所有职位须符合当地法律");

  // The footer's switch is there on every screen: it names English in English.
  await footer.getByRole("button", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-NZ");
  await expect(page).toHaveURL(/\/jobs$/);
  await expect(footer).toContainText("Every job must follow New Zealand law");
  expect((await page.context().cookies(baseURL)).find((c) => c.name === "zg_lang")).toMatchObject({
    value: "en",
    httpOnly: true,
  });

  // Another page in the same browser is English too; back through the switch to Chinese.
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-NZ");
  await footer.getByRole("button", { name: "中文" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(footer).toContainText("所有职位须符合当地法律");
});

test("an address with no page shows the 404 card in the page's language", async ({ page, baseURL }) => {
  await page.context().addCookies([{ name: "zg_lang", value: "en", url: baseURL! }]);
  const answer = await page.goto("/no-such-page");
  expect(answer?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "This page doesn't exist" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-NZ");
});

test("a file name that isn't a file is a 404 too, not the home page (#235 review)", async ({ page, baseURL }) => {
  // Through the proxy: the card in the cookie's language.
  await page.context().addCookies([{ name: "zg_lang", value: "en", url: baseURL! }]);
  for (const path of ["/favicon.ico", "/ads.txt"]) {
    expect((await page.goto(path))?.status(), path).toBe(404);
    await expect(page.getByRole("heading", { level: 1, name: "This page doesn't exist" })).toBeVisible();
  }
  // The kinds of file the proxy leaves alone reach app/[lang] with the name as the language: the root layout turns
  // them away (Next's own 404), never the home page.
  expect((await page.goto("/no-such-icon.png"))?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: "Chinese-speaking jobs in New Zealand" })).toHaveCount(0);
});
