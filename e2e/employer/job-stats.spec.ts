// 职位数据 (#55, R-31): views, chats started and contact views on 职位管理, and the last 14 days on their own page.
import { expect, test } from "@playwright/test";
import { publishJob, signUpEmployer, uniqueTitle } from "./helpers";
import { signIn } from "../helpers";

test("a seeker's view and first message show on the employer's numbers, once each", async ({
  page,
  browser,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("数据服务员", testInfo);
  const jobId = await publishJob(page, title);
  expect(jobId).toMatch(/^j\d+$/);

  // The business opening its own job is not a view.
  await page.goto(`/jobs/${jobId}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  const seeker = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await signIn(seeker, `/jobs/${jobId}`);
  await seeker.reload(); // a second load the same day counts once
  await seeker.getByRole("button", { name: "立即沟通", exact: true }).click();
  await expect(seeker.getByRole("log")).toContainText("尚未发送消息");
  for (const text of ["您好，还在招人吗？", "周末可以上班。"]) {
    await seeker.getByLabel("输入消息").fill(text);
    await seeker.getByRole("button", { name: "发送", exact: true }).click();
    await expect(seeker.getByRole("log")).toContainText(text);
  }
  await seeker.context().close();

  await page.goto("/employer/jobs");
  const row = page.locator("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(row).toContainText("1 次浏览");
  await expect(row).toContainText("1 人聊过");
  await expect(row).toContainText("不公开 · 聊天交换");

  await row.getByRole("link", { name: "近 14 天" }).click();
  await expect(page).toHaveURL(`/employer/jobs/${jobId}/stats`);
  await expect(page.getByRole("heading", { name: "职位数据" })).toBeVisible();
  const table = page.getByRole("table", { name: /最近 14 天/ });
  await expect(table.getByRole("row")).toHaveCount(15); // the header and 14 days
  // Newest first: today has the view and the chat; contact details are not public on this job.
  await expect(table.getByRole("row").nth(1).getByRole("cell")).toHaveText([/^1/, "1", "—"]);
});

test("a reload right after the first view counts once, even when the first count's answer never arrives (#79)", async ({
  page,
  browser,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  const title = uniqueTitle("刷新服务员", testInfo);
  const jobId = await publishJob(page, title);
  expect(jobId).toMatch(/^j\d+$/);

  // A new browser opens the job, and leaves (here: reloads) before the answer to its view count comes back. The
  // count reaches the server; whatever that answer would have set in the browser never arrives.
  const seeker = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  const isCount = (request: { method(): string; postData(): string | null }) =>
    request.method() === "POST" && request.postData() === JSON.stringify([jobId]);
  let firstCount!: () => void;
  const counted = new Promise<void>((resolve) => (firstCount = resolve));
  await seeker.route(`**/jobs/${jobId}`, async (route) => {
    if (!isCount(route.request())) return route.continue();
    const context = seeker.context();
    const kept = (await context.cookies()).filter((c) => c.name === "zg_visitor");
    await route.fetch(); // the server records the view
    await route.abort(); // the browser never sees the answer
    // route.fetch() stores the answer's cookies in the context; put back what the browser had before.
    await context.clearCookies({ name: "zg_visitor" });
    await context.addCookies(kept);
    firstCount();
  });
  await seeker.goto(`/jobs/${jobId}`);
  await counted;
  await seeker.unrouteAll({ behavior: "ignoreErrors" });
  const second = seeker.waitForResponse((response) => isCount(response.request()));
  await seeker.reload();
  await second;
  await seeker.context().close();

  await page.goto("/employer/jobs");
  const row = page.locator("article").filter({ has: page.getByRole("heading", { name: title }) });
  await expect(row).toContainText("1 次浏览");
});

test("another business's job has no numbers to show", async ({ page }, testInfo) => {
  await signUpEmployer(page, testInfo);
  await page.goto("/employer/jobs/j1/stats");
  await expect(page.getByText("找不到这个职位，或者它不属于你登录的店铺。")).toBeVisible();
});
