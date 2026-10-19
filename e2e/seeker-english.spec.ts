import { expect, test } from "@playwright/test";
import { chineseLeft, expectEnglishPage, useEnglish } from "./helpers/english";
import { freshEmail, signIn } from "./helpers";

// Round 20 step 2, line A (#237): the job seeker's pages with zg_lang=en — <html lang>, axe, nothing wider than the
// screen, and no Chinese of the interface left (e2e/helpers/english.ts). Both projects. Pages that also show other
// lines' parts (the business page's chat activity, 我的主页's checklist, 通知) are checked once those parts are
// connected too.

test("signed out: the home page, the job list with filters, and a job page", async ({ page, baseURL }) => {
  await useEnglish(page, baseURL);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Chinese-speaking jobs in New Zealand");
  await expectEnglishPage(page, "/");

  await page.goto("/jobs?industry=hospitality&meals=1");
  await expect(page.getByRole("region", { name: "Jobs" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Remove filter: Hospitality" })).toBeVisible();
  await expectEnglishPage(page, "/jobs with filters");

  await page.goto("/jobs/j5");
  await expect(page.getByRole("region", { name: "About the job" })).toBeVisible();
  await expect(page.getByText(/an hour/).first()).toBeVisible();
  await expectEnglishPage(page, "/jobs/j5");
});

test("signed in: saved and applied, job alerts, history and reports, the workspace and the CV", async ({
  page,
  baseURL,
}) => {
  // The shared signIn() reads the Chinese sign-in page: sign in first, then switch the browser to English. (The
  // account keeps Chinese as its choice; the cookie decides the pages until the next sign-in.)
  await signIn(page, "/jobs", freshEmail("english.seeker"));
  await useEnglish(page, baseURL);
  await page.goto("/jobs?industry=retail");
  await page.getByRole("button", { name: "Save as an alert" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved as an alert" })).toBeVisible();

  for (const [path, heading] of [
    ["/me/saved", "Saved and applied"],
    ["/me/alerts", "Job alerts"],
    ["/me", "History and reports"],
    ["/workspace", "Job seeker workspace"],
    ["/profile/resume", "CV (Chinese and English)"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectEnglishPage(page, path);
  }
});

test("chineseLeft: a person's title quoted in an aria-label passes even when it holds an allowed word (#241)", async ({
  page,
}) => {
  // A job another spec published, titled 招聘…: the title link is marked zh-CN and the Save button quotes it. The
  // 招 of ALLOWED_CHINESE must not be taken out of the label before the title is, or the rest reads as a missed
  // translation. The unmarked button underneath keeps the check honest: its Chinese is nobody's text.
  await page.setContent(`
    <html lang="en-NZ"><body>
      <article>
        <a href="#" lang="zh-CN">招聘记录服务员M241</a>
        <button aria-label="Save: 招聘记录服务员M241">Save</button>
        <button aria-label="Apply: 招聘记录服务员M241">Apply</button>
        <span>招</span>
      </article>
      <button aria-label="Save: 招聘厨师">Save</button>
    </body></html>`);
  expect(await chineseLeft(page)).toEqual([{ text: "Save: 招聘厨师", where: "button [aria-label]" }]);
});
