// E5 (brief-A-12, zg-scratch/a-ed3d/e5/audit.md): the business's main paths on a 375 × 812 phone. New measures of
// their own; A21 (three job cards a screen) is not changed by them.
import { expect, test, type Locator } from "@playwright/test";
import { chatAboutJob, chatMenuItem, freshEmail, signIn } from "./helpers";
import { candidateCard, publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

const box = async (locator: Locator) => (await locator.boundingBox())!;

test("E5-1 chat on a phone: the job and the marks share a row, activity is one line, four 常用语 show; the job seeker's chat keeps its bars", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "the phone's screen");
  await signUpEmployer(page, testInfo, "/workspace", { demo: true });
  const jobId = (await publishJob(page, uniqueTitle("手机聊天服务员", testInfo)))!;
  const seeker = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.e5.chat"));
  await chatAboutJob(seeker, jobId, "请问可以先试工吗？");

  await (await candidateCard(page, jobId)).getByRole("button", { name: "打开聊天" }).click();
  await expect(page).toHaveURL(/\/messages\?conversation=chat%3A/);
  const job = page.getByRole("link", { name: /^聊的职位：/ });
  const marks = page.getByRole("group", { name: "标记这位求职者" });
  const activity = page.getByLabel("沟通状态", { exact: true });
  const log = page.getByRole("log", { name: "消息记录" });
  await expect(marks).toBeVisible();
  await expect(log).toContainText("请问可以先试工吗？");

  // The job and 合适 / 已录用 in one row; the activity one line, 演示状态 still said.
  const [jobBox, marksBox] = [await box(job), await box(marks)];
  expect(Math.abs(jobBox.y + jobBox.height / 2 - (marksBox.y + marksBox.height / 2))).toBeLessThan(2);
  expect(jobBox.x + jobBox.width).toBeLessThanOrEqual(marksBox.x);
  expect(marksBox.x + marksBox.width).toBeLessThanOrEqual(375);
  expect((await box(activity)).height).toBeLessThanOrEqual(30);
  await expect(activity).toContainText("演示状态");
  // The messages start at most 140 px down (232 for the first message in the walk, its log at 212).
  const logTop = (await box(log)).y;
  const first = await box(log.getByText("请问可以先试工吗？"));
  testInfo.annotations.push({ type: "E5-1", description: `log top ${logTop}, first message text ${first.y}` });
  expect(logTop).toBeLessThanOrEqual(140);

  // 常用语: two lines, at least three whole in view without a sideways swipe (one was).
  const chips = page.getByRole("list", { name: "常用语" }).getByRole("button");
  await expect(chips.first()).toBeVisible();
  const chipBoxes = await Promise.all((await chips.all()).map(box));
  expect(new Set(chipBoxes.map((b) => Math.round(b.y))).size).toBe(2);
  expect(chipBoxes.filter((b) => b.x >= 0 && b.x + b.width <= 375).length).toBeGreaterThanOrEqual(3);
  for (const b of chipBoxes) expect(b.height).toBeGreaterThanOrEqual(44);

  // 这个职位聊过的人 is in 更多 now, a full-size item.
  const all = await chatMenuItem(page, "这个职位聊过的人");
  expect((await box(all)).height).toBeGreaterThanOrEqual(44);
  await all.click();
  await expect(page).toHaveURL(`/employer/jobs/${jobId}/applicants`);

  // The job seeker's side is as it was: the job is a bar of its own with the pay, no marks, 常用语 in one line.
  const seekerJob = seeker.getByRole("link", { name: /^聊的职位：/ });
  await expect(seekerJob).toBeVisible();
  const seekerJobBox = await box(seekerJob);
  expect(seekerJobBox.width).toBeGreaterThanOrEqual(370);
  await expect(seekerJob.getByText(/\$\d/)).toBeVisible();
  await expect(seeker.getByRole("group", { name: "标记这位求职者" })).toHaveCount(0);
  const seekerChips = await Promise.all(
    (await seeker.getByRole("list", { name: "常用语" }).getByRole("button").all()).map(box),
  );
  expect(new Set(seekerChips.map((b) => Math.round(b.y))).size).toBe(1);
  await seeker.context().close();
});
