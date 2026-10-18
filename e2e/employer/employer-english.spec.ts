import { expect, test, type Page } from "@playwright/test";
import { expectEnglishPage, useEnglish } from "../helpers/english";
import { SAMPLE_POST } from "../../src/lib/ai-post/chat-start";
import { CLEAN_MESSAGE, publishJob, signUpEmployer, uniqueTitle } from "./helpers";

// Round 20 step 2, line B (#238): the employer's pages with zg_lang=en — <html lang>, axe, nothing wider than the
// screen, and no Chinese of the interface left (e2e/helpers/english.ts). Both projects. The business and its job are
// set up in Chinese first (the shared helpers speak Chinese); what the employer wrote (the shop's name, the job's
// Chinese title, the pasted message) is marked lang="zh-CN" on the page and passes.

// Chinese on purpose: the form asks for the job's Chinese title and shows a Chinese example (e.g. 前厅服务员); the
// paste box's placeholder is a sample WeChat post, which is Chinese like the posts it stands for.
const FORM_EXAMPLES = ["前厅服务员", SAMPLE_POST.replace(/\s+/g, " ").trim()];

async function shopId(page: Page): Promise<string> {
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem("zhaogong:session") ?? "{}").employerId);
  expect(id, "the session names the business").toBeTruthy();
  return id as string;
}

test("the employer's pages in English: home, 职位管理, applicants, 推荐人才, 团队, 企业验证, 聊天, the business page", async ({
  page,
  baseURL,
}, testInfo) => {
  test.slow();
  await signUpEmployer(page, testInfo, "/employer");
  const title = uniqueTitle("前厅服务员", testInfo);
  const jobId = await publishJob(page, title);
  expect(jobId).toBeTruthy();
  const employerId = await shopId(page);

  await useEnglish(page, baseURL);
  await page.goto("/employer");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectEnglishPage(page, "/employer");

  await page.goto("/employer/jobs");
  await expect(page.getByRole("heading", { level: 1, name: "My jobs" })).toBeVisible();
  await expect(page.getByRole("article").filter({ hasText: title })).toBeVisible();
  await expectEnglishPage(page, "/employer/jobs");

  await page.goto(`/employer/jobs/${jobId}/applicants`);
  await expect(page.getByRole("heading", { level: 1, name: "Applicants" })).toBeVisible();
  await expectEnglishPage(page, "applicants (none yet)");

  await page.goto(`/employer/jobs/${jobId}/stats`);
  await expect(page.getByRole("heading", { level: 1, name: "Job stats" })).toBeVisible();
  await expectEnglishPage(page, "job stats");

  await page.goto("/employer/candidates");
  await expect(page.getByRole("heading", { level: 1, name: "Suggested candidates" })).toBeVisible();
  await expectEnglishPage(page, "/employer/candidates");

  await page.goto("/employer/team");
  await expect(page.getByRole("heading", { level: 1, name: "Team" })).toBeVisible();
  await expectEnglishPage(page, "/employer/team");

  await page.goto("/employer/verify");
  await expect(page.getByRole("heading", { level: 1, name: "Business verification" })).toBeVisible();
  await expectEnglishPage(page, "/employer/verify");
  await page.getByLabel("Business name or NZBN").fill("Demo");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("listitem").first()).toBeVisible();
  // The register's names are English and NZBNs are figures; nothing Chinese of the interface may be left.
  await expectEnglishPage(page, "/employer/verify with results");

  await page.goto("/messages");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectEnglishPage(page, "/messages (employer)");

  await page.goto(`/employers/${employerId}`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectEnglishPage(page, "the business page");
});

test("posting in English: the chat, then paste → check → preview", async ({ page, baseURL }, testInfo) => {
  test.slow();
  await signUpEmployer(page, testInfo);
  await useEnglish(page, baseURL);

  await page.goto("/employer/post");
  await expect(page.getByRole("list", { name: "Posting steps" })).toBeVisible();
  await expectEnglishPage(page, "post: chat");

  await page.getByRole("button", { name: "Fill in the form", exact: true }).click();
  const paste = page.getByLabel(/Paste the job message from your WeChat group/);
  await expect(paste).toBeVisible();
  await expectEnglishPage(page, "post: paste", { allow: FORM_EXAMPLES });

  await paste.fill(CLEAN_MESSAGE);
  await page.getByRole("button", { name: "Turn into a job" }).click();
  await expect(page.getByLabel("Job title (Chinese)")).not.toHaveValue("");
  await expectEnglishPage(page, "post: check", { allow: FORM_EXAMPLES });

  await page.getByRole("button", { name: "Preview", exact: true }).click();
  await expect(page.getByText(/^Preview: this is what job seekers see/).filter({ visible: true })).toBeVisible();
  await expectEnglishPage(page, "post: preview");
});
