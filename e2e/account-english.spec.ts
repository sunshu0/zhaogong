import { expect, test, type Page } from "@playwright/test";
import { freshEmail } from "./helpers";
import { moderatorPage } from "./employer/helpers";
import { expectEnglishPage, useEnglish } from "./helpers/english";

// Round 20 step 2, line C (#236): line C's pages with zg_lang=en — <html lang>, axe, nothing wider than the screen,
// and no Chinese of the interface left (e2e/helpers/english.ts). Sign-in with every step, 我的, 数据与账号, 通知,
// each tab of 审核后台, and the external job sections and a job. Both projects. Nothing is submitted that changes data
// other specs read: the business step and the delete button are shown, not pressed.

// Round 19 cards pop in and fade: the checks run on the settled page, as with "reduce motion".
test.use({ reducedMotion: "reduce" });

/** Signs in through the English /login: email, then the code it was sent; ends on `next`. */
async function signInInEnglish(page: Page, next: string, email = freshEmail("english.c")) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  const shown = page.getByTestId("dev-sign-in-code");
  await expect(shown).toHaveText(/^\d{6}$/);
  await page.getByLabel("Sign-in code").fill((await shown.textContent())!.trim());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(next);
  return email;
}

test("sign-in in English: the email step, a mistyped domain, the code with its countdown, the business step", async ({
  page,
  baseURL,
}) => {
  await useEnglish(page, baseURL);
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Sign in or sign up" })).toBeVisible();
  const field = page.getByLabel("Email", { exact: true });
  await expectEnglishPage(page, "/login email step");

  const name = freshEmail("english.login").split("@")[0];
  await field.fill(`${name}@gmial.com`);
  await field.blur();
  await expect(page.getByRole("button", { name: `Change to ${name}@gmail.com` })).toBeVisible();
  await expectEnglishPage(page, "/login with the mistyped-domain hint");

  await page.getByRole("button", { name: `Change to ${name}@gmail.com` }).click();
  await page.getByRole("radio", { name: /Hire people/ }).check();
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("button", { name: /^New code in \d+ s$/ })).toBeDisabled();
  await expect(page.getByText(/^We sent a sign-in code to/)).toBeVisible();
  await expectEnglishPage(page, "/login code step, counting down");

  const shown = page.getByTestId("dev-sign-in-code");
  await expect(shown).toHaveText(/^\d{6}$/);
  await page.getByLabel("Sign-in code").fill("000000");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // A wrong code is answered in English too (the Server Function reads the zg_lang cookie).
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(/^That code isn't right\. \d tries? left\.$/);
  await page.getByLabel("Sign-in code").fill((await shown.textContent())!.trim());
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Set up hiring" })).toBeVisible();
  // The demo shops' own names are the businesses' words: marked lang="zh-CN", so they pass.
  await expectEnglishPage(page, "/login business step");
  await page.getByRole("radio", { name: /Add a business/ }).check();
  await page.getByRole("button", { name: /^Area/ }).click();
  await expect(page.getByRole("listbox", { name: "Area", exact: true })).toBeVisible();
  await expectEnglishPage(page, "/login business step, Add a business with Area open");
});

test("my account, data and account, notifications in English", async ({ page, baseURL }) => {
  await useEnglish(page, baseURL);
  const email = await signInInEnglish(page, "/account");
  await expect(page.getByRole("link", { name: /Data and account/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expectEnglishPage(page, "/account");

  await page.goto("/account/data");
  await expect(page.getByRole("heading", { level: 1, name: "Data and account" })).toBeVisible();
  const confirm = page.getByLabel(/To confirm, type your sign-in email/);
  await expectEnglishPage(page, "/account/data");
  await confirm.fill(email);
  await expect(page.getByRole("button", { name: "Delete my account for good" })).toBeEnabled();
  await expectEnglishPage(page, "/account/data, delete ready (not pressed)");

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { level: 2, name: "All notifications" })).toBeVisible();
  await expectEnglishPage(page, "/notifications");
});

test("moderation in English: every tab", async ({ browser, baseURL }, testInfo) => {
  const admin = await moderatorPage(browser, testInfo);
  await useEnglish(admin, baseURL);
  await admin.goto("/admin");
  await expect(admin.getByRole("heading", { level: 1, name: "Moderation" })).toBeVisible();
  await expect(admin.getByText("Jobs waiting for review", { exact: true })).toBeVisible();

  // Job titles, descriptions, business names and report notes are what people wrote (marked lang="zh-CN"). The log's
  // sentences quote them inside “…”, (…) and after " · ", in English sentences: those parts are allowed there.
  const quoted = [/“[^”]*”/, /\([^()]*\)/, / · .*$/];
  for (const [tab, ready, allow] of [
    ["Flagged when posted", /^(No jobs waiting for review\.|.+)$/, []],
    ["Reported", /Only reports about jobs come here/, []],
    ["Business verification", /^(No business verification waiting for review\.|Tick each item)/, []],
    ["External jobs", /^Waiting for review \d+$/, []],
    ["Log", /^(Nothing in the log yet\.|By .+)$/, quoted],
    ["Access log", /^(Nothing in this period\.|\d+ lines?, newest first)$/, []],
    ["Moderation stats", /^Last \d+ weeks$/, []],
    ["Moderators", /^Moderators · \d+$/, []],
  ] as const) {
    await admin.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
    await expect(admin.getByRole("tab", { name: new RegExp(`^${tab}`) })).toHaveAttribute("aria-selected", "true");
    await expect(admin.getByRole("tabpanel").getByText(ready).first()).toBeVisible();
    await expectEnglishPage(admin, `/admin ${tab}`, { allow });
  }

  // A form opened: the reasons for not showing an external job, then 取消.
  await admin.getByRole("tab", { name: /^External jobs/ }).click();
  const job = admin.getByRole("article", { name: /^External job: / }).first();
  if ((await job.count()) > 0) {
    await job.getByRole("button", { name: /^(Don't show|Take it down)$/ }).click();
    await expect(job.getByRole("group", { name: "Why not show it" })).toBeVisible();
    await expectEnglishPage(admin, "/admin External jobs, Don't show form open");
    await job.getByRole("button", { name: "Cancel" }).click();
  }
  await admin.context().close();
});

test("external jobs in English: both sections, the filters, a job", async ({ page, baseURL }) => {
  await useEnglish(page, baseURL);
  await page.goto("/internships");
  await expect(page.getByRole("heading", { level: 1, name: "Internships" })).toBeVisible();
  await expect(page.getByRole("form", { name: "Filters" })).toBeVisible();
  await expectEnglishPage(page, "/internships");

  await page.goto("/professional?field=software");
  await expect(page.getByRole("heading", { level: 1, name: "Professional jobs" })).toBeVisible();
  await expect(page.getByText(/^(\d+ of \d+ found|No jobs match these filters\.)$/)).toBeVisible();
  await expectEnglishPage(page, "/professional with a filter");

  await page.goto("/professional");
  const first = page.getByRole("list").getByRole("article").first().getByRole("link").first();
  if ((await first.count()) > 0) {
    await first.click();
    await expect(
      page.getByRole("heading", { level: 2, name: "About the job (from the original posting)" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Apply on the company's site", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "This is a demo job" })).toBeVisible();
    await expectEnglishPage(page, "/external/[id]");
  }
  await expect(page.getByRole("heading", { name: "Removal requested by the company" })).toBeVisible();
});
