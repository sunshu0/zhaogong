// #246: when an employer page's Server Function calls get no answer (no network, the server restarting), a list or card
// that could not be loaded says so in its place, with 重试, instead of waiting on its skeleton for good. The tests cut
// the network for the page's Server Function calls (POSTs to its own path); the page and its scripts still load.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signUpEmployer } from "./helpers";

test.use({ reducedMotion: "reduce" });

/** Cuts the Server Function calls made from `path` while `cut.on` is true. */
async function cutCalls(page: Page, path: string) {
  const cut = { on: false };
  await page.route(
    (url) => url.pathname === path,
    (route) => (cut.on && route.request().method() === "POST" ? route.abort("internetdisconnected") : route.fallback()),
  );
  return cut;
}

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
}

test("employer lists that get no answer say so in their place, and 重试 asks again (#246)", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo, "/employer/jobs");
  await expect(page.getByRole("heading", { name: "职位管理" })).toBeVisible();

  for (const [path, words, back] of [
    ["/employer/jobs", "职位没取到", page.getByText("还没有发布过职位。")],
    ["/employer/team", "团队没取到", page.getByRole("heading", { name: "团队", exact: true })],
    ["/employer/verify", "企业验证没取到", page.getByRole("heading", { name: "1. 在企业登记里找到你的公司" })],
  ] as const) {
    const cut = await cutCalls(page, path);
    cut.on = true;
    await page.goto(path);
    const failed = page.getByRole("alert").filter({ hasText: words });
    await expect(failed).toBeVisible();
    await expectNoViolations(page);

    cut.on = false;
    await failed.getByRole("button", { name: "重试" }).click();
    await expect(failed).toHaveCount(0);
    await expect(back).toBeVisible();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});
