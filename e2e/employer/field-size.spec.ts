import { expect, test, type Page } from "@playwright/test";
import { signUpEmployer } from "./helpers";

// #356: an iPhone zooms the page into a text field whose text is under 16 px. Every visible field that takes typing,
// on the employer pages that have them (posting, 企业验证, 团队), is 16 px or more.

/** The visible typing fields on the page whose computed font size is under 16 px, by their label or name. */
async function smallFields(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("input, textarea, select")]
      .filter(
        (el) => !["checkbox", "radio", "file", "hidden", "range", "color"].includes(el.getAttribute("type") ?? ""),
      )
      .filter((el) => el.offsetParent !== null)
      .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
      .map((el) => el.getAttribute("aria-label") ?? el.getAttribute("name") ?? el.id ?? el.outerHTML.slice(0, 80)),
  );
}

test("every typing field on the employer pages is 16 px or more (#356)", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  for (const path of ["/employer/post", "/employer/verify", "/employer/team"]) {
    await page.goto(path);
    await expect(page.locator("input:visible, textarea:visible").first()).toBeVisible();
    expect(await smallFields(page), path).toEqual([]);
  }
  // The posting form's own fields: 直接填表 → 不用粘贴，直接填表.
  await page.goto("/employer/post");
  await page.getByRole("button", { name: "直接填表", exact: true }).click();
  await page.getByRole("button", { name: "不用粘贴，直接填表" }).click();
  await expect(page.getByLabel("职位名称（中文）")).toBeVisible();
  expect(await smallFields(page), "the posting form").toEqual([]);
});
