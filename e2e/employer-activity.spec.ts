// 老板活跃度 (#381, ADR 0038): a business whose team used the site today shows 今天在线 on its job's card and page,
// in both languages; how soon it replies shows only once five job seekers wrote to it (unit tests: employer-activity).
import { expect, test } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

test("a business in use today shows 今天在线 on its job page and card, and nothing slow", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("今天在线服务员", testInfo);
  const jobId = await publishJob(page, title);

  // Someone else, signed out: the job page and the job's card in the list.
  const visitor = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await visitor.goto(`/jobs/${jobId}`);
  const employer = visitor.getByRole("region", { name: "雇主", exact: true });
  await expect(employer.locator("[data-employer-activity]")).toHaveText("今天在线");
  await visitor.goto(`/jobs?q=${encodeURIComponent(title)}`);
  const card = visitor.getByRole("article").filter({ hasText: title });
  await expect(card.locator("[data-employer-activity]")).toHaveText("今天在线");
  await expect(card).not.toContainText("回复");

  await visitor.context().addCookies([{ name: "zg_lang", value: "en", url: baseURL! }]);
  await visitor.goto(`/jobs/${jobId}`);
  await expect(visitor.locator("[data-employer-activity]").filter({ visible: true })).toHaveText("Online today");
  await visitor.context().close();

  // A job seeker signed in, in a browser of their own, sees the same.
  const seeker = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.activity.seeker"));
  await expect(seeker.locator("[data-employer-activity]").filter({ visible: true })).toHaveText("今天在线");
  await seeker.context().close();
});
