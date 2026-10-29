// E5-2 (brief-A-12, zg-scratch/a-ed3d/e5/audit.md): 聊过这个职位的人 on a 375 × 812 phone. New measures of their own;
// A21 (three job cards a screen) is not changed by them.
import { expect, test, type Locator } from "@playwright/test";
import { chatAboutJob, freshEmail, signIn } from "./helpers";
import { publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

const box = async (locator: Locator) => (await locator.boundingBox())!;

test("E5-2 聊过的人 on a phone: one line of the note, 打开聊天 beside 约面试, two whole cards a screen; 职位管理's links are finger high", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "the phone's screen");
  await signUpEmployer(page, testInfo, "/workspace", { demo: true });
  const jobId = (await publishJob(page, uniqueTitle("手机候选服务员", testInfo)))!;
  for (const [i, text] of ["周末都可以上班", "请问可以先试工吗？"].entries()) {
    const context = await browser.newContext({ ...testInfo.project.use });
    const seeker = await context.newPage();
    await signIn(seeker, `/jobs/${jobId}`, freshEmail(`e2e.e5.card${i}`));
    await chatAboutJob(seeker, jobId, text);
    await context.close();
  }

  // 职位管理: 近 14 天 and 聊过的人 are 44 px high.
  await page.goto("/employer/jobs");
  for (const name of [/^近 14 天/, /^聊过的人/]) {
    const link = page.getByRole("main").getByRole("link", { name }).first();
    await expect(link).toBeVisible();
    expect((await box(link)).height).toBeGreaterThanOrEqual(44);
  }

  // Both job seekers are 求职者 (no name yet), so wait for the list to hold both cards rather than one by name;
  // the second message may still be on its way to the server.
  const cards = page.getByRole("list", { name: "聊过的人" }).getByRole("article");
  await expect(async () => {
    await page.goto(`/employer/jobs/${jobId}/applicants`);
    await expect(cards).toHaveCount(2, { timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  const first = cards.first();

  // The note: one line that opens the whole of it.
  const more = page.getByText("看说明", { exact: true });
  await expect(page.getByText("标「不合适」「已录用」时对方会看到。")).toBeVisible();
  await expect(page.getByText(/^这里没有对方的联系方式/)).toBeHidden();
  const summary = page.locator("summary").filter({ has: more });
  expect((await box(summary)).height).toBeGreaterThanOrEqual(44);

  // 打开聊天 and 约面试 on one line; the marks under them.
  const chat = first.getByRole("button", { name: "打开聊天" });
  const invite = first.getByRole("button", { name: "约面试" });
  const marks = first.getByRole("group", { name: /^标记/ });
  const [chatBox, inviteBox, marksBox] = [await box(chat), await box(invite), await box(marks)];
  expect(Math.abs(chatBox.y - inviteBox.y)).toBeLessThan(2);
  expect(marksBox.y).toBeGreaterThan(chatBox.y + chatBox.height);

  // Two whole cards on the first screen (one was, its top at 317 px).
  const tops = [];
  for (const card of await cards.all()) tops.push(await box(card));
  testInfo.annotations.push({
    type: "E5-2",
    description: `first card top ${tops[0].y}, heights ${tops.map((b) => b.height).join(", ")}`,
  });
  expect(tops.filter((b) => b.y >= 0 && b.y + b.height <= 755).length).toBeGreaterThanOrEqual(2);

  // Open, the whole note is there.
  await summary.click();
  await expect(page.getByText(/^这里没有对方的联系方式/)).toBeVisible();
});
