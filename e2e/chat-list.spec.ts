// C7 (brief-A-C7.md, ADR 0053): the chat list's filters — 全部 / 新招呼 / 沟通中 / 已约面 — pins and 标为未读. On a phone, new
// measures of their own (boundingBox, as A21 measures; A21 is not changed by them).
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { chatAboutJob, freshEmail, signIn } from "./helpers";
import { candidateCard, publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

const box = async (locator: Locator) => (await locator.boundingBox())!;

/** A measure, in the report and in the gate's log. */
function measure(testInfo: TestInfo, description: string) {
  testInfo.annotations.push({ type: "C7", description });
  console.log(`C7: ${description}`);
}

/** The heading row the filters took the place of: py-3 and one 24 px line, and its 1 px rule. */
const OLD_HEADING = 49;

const chatList = (page: Page) => page.getByRole("complementary", { name: "聊天列表" });
const rows = (page: Page) => chatList(page).getByRole("list").getByRole("button");
const filter = (page: Page, name: string) =>
  chatList(page)
    .getByRole("group", { name: "按状态看" })
    .getByRole("button", { name: new RegExp(`^${name} \\d+$`) });

async function backToList(page: Page, testInfo: TestInfo) {
  if (testInfo.project.name === "mobile") await page.getByRole("button", { name: "返回会话列表" }).click();
  await expect(chatList(page)).toBeVisible();
}

test("C7 chat list: 新招呼 / 沟通中 / 已约面 and pins; on a phone the filters take the heading's row", async ({
  page,
  browser,
}, testInfo) => {
  // A demo business: 林晓 (both have spoken), 陈雨 and 王宁 (only they have), and a job seeker who wrote about a job.
  await signUpEmployer(page, testInfo, "/workspace", { demo: true });
  const jobId = (await publishJob(page, uniqueTitle("聊天分组服务员", testInfo)))!;
  const context = await browser.newContext({ ...testInfo.project.use });
  const seeker = await context.newPage();
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.c7.list"));
  await chatAboutJob(seeker, jobId, "你好，还招人吗？");
  await context.close();

  await page.goto("/messages");
  await expect(rows(page)).toHaveCount(4);
  await expect(filter(page, "全部")).toHaveText("全部 4");
  await expect(filter(page, "全部")).toHaveAttribute("aria-pressed", "true");
  await expect(filter(page, "新招呼")).toHaveText("新招呼 3");
  await expect(filter(page, "沟通中")).toHaveText("沟通中 1");
  await expect(filter(page, "已约面")).toHaveText("已约面 0");

  await filter(page, "新招呼").click();
  await expect(filter(page, "新招呼")).toHaveAttribute("aria-pressed", "true");
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).filter({ hasText: "林晓" })).toHaveCount(0);
  await filter(page, "沟通中").click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("林晓");
  await filter(page, "已约面").click();
  await expect(rows(page)).toHaveCount(0);
  await expect(chatList(page)).toContainText("「已约面」里还没有会话。");
  await filter(page, "全部").click();
  await expect(rows(page)).toHaveCount(4);

  const wang = rows(page).filter({ hasText: "王宁" });
  const before = await box(wang);
  if (testInfo.project.name === "mobile") {
    // 1. The filters are one line of finger-sized buttons.
    const filters = chatList(page).getByRole("group", { name: "按状态看" });
    const line = await box(filters);
    expect(line.height).toBeLessThan(2 * 44);
    for (const name of ["全部", "新招呼", "沟通中", "已约面"]) {
      const b = await box(filter(page, name));
      expect(b.width).toBeGreaterThanOrEqual(44);
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
    // 3. As many whole rows fit in the list as with the heading row it replaced.
    const list = await box(chatList(page));
    const first = await box(rows(page).nth(0));
    const step = (await box(rows(page).nth(1))).y - first.y;
    const fit = (top: number) => Math.floor((list.y + list.height - top + (step - first.height)) / step);
    const now = fit(first.y);
    const then = fit(first.y - line.height + OLD_HEADING);
    expect(now).toBeGreaterThanOrEqual(then);
    measure(
      testInfo,
      `375x812: filters ${line.height} px high (heading was ${OLD_HEADING}); row ${first.height} px, step ${step}; whole rows that fit: ${now} (with the heading: ${then})`,
    );
  }

  // Pinned from the chat's 更多: first in the list, marked, the row as high as before; kept on the server.
  await wang.click();
  await page.getByRole("button", { name: "更多：王宁" }).click();
  await page.getByRole("menuitem", { name: "置顶", exact: true }).click();
  await backToList(page, testInfo);
  await expect(rows(page).first()).toContainText("王宁");
  await expect(rows(page).first()).toHaveAccessibleName(/王宁.*已置顶/);
  const pinned = await box(rows(page).first());
  // 2. The pin adds no height.
  expect(Math.abs(pinned.height - before.height)).toBeLessThanOrEqual(1);
  if (testInfo.project.name === "mobile")
    measure(testInfo, `375x812: row ${before.height} px, pinned ${pinned.height} px`);
  await page.reload();
  await expect(rows(page).first()).toContainText("王宁");
  // Pinned first within a group too.
  await filter(page, "新招呼").click();
  await expect(rows(page).first()).toContainText("王宁");
  await filter(page, "全部").click();

  // 4. An interview invitation puts the job seeker's chat under 已约面 (the next read has it).
  const card = await candidateCard(page, jobId);
  await card.getByRole("button", { name: "约面试" }).click();
  await page.getByRole("radio", { name: "电话联系后再定" }).check();
  await card.getByRole("button", { name: "发出邀约" }).click();
  await expect(card.getByRole("status", { name: "和求职者的面试" })).toContainText("已发邀约");
  await page.goto("/messages");
  await expect(filter(page, "已约面")).toHaveText("已约面 1");
  await expect(filter(page, "新招呼")).toHaveText("新招呼 2");
  await filter(page, "已约面").click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).not.toContainText("林晓");

  // The pin comes off the same way.
  await filter(page, "全部").click();
  await rows(page).first().click();
  await page.getByRole("button", { name: "更多：王宁" }).click();
  await page.getByRole("menuitem", { name: "取消置顶" }).click();
  await backToList(page, testInfo);
  await expect(rows(page).first()).not.toHaveAccessibleName(/已置顶/);
});

test("C7 标为未读: a dot in the list until the chat is opened again; counts and the other side's 已读 stay", async ({
  page,
  browser,
}, testInfo) => {
  test.slow();
  await signUpEmployer(page, testInfo, "/workspace");
  const jobId = (await publishJob(page, uniqueTitle("标为未读服务员", testInfo)))!;
  const seeker = await (await browser.newContext({ ...testInfo.project.use })).newPage();
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.c7.unread"));
  await chatAboutJob(seeker, jobId, "你好，周末可以上班吗？");

  // The business reads it: the job seeker sees 已读.
  await page.goto("/messages");
  const row = rows(page).filter({ hasText: "你好，周末可以上班吗？" });
  await row.click();
  await expect(page.getByRole("log", { name: "消息记录" })).toContainText("你好，周末可以上班吗？");
  await backToList(page, testInfo);
  await expect(page.getByText("消息已全部读完")).toBeVisible();
  const before = await box(row);
  const read = seeker.getByRole("log", { name: "消息记录" }).locator("[data-message-read]").first();
  await expect(read).toHaveText("已读", { timeout: 20_000 });

  // 更多 → 标为未读: back in the list with a dot where a count would be, the row as high as before.
  await row.click();
  await page.getByRole("button", { name: /^更多：/ }).click();
  await page.getByRole("menuitem", { name: "标为未读" }).click();
  await expect(chatList(page)).toBeVisible();
  await expect(row).toHaveAccessibleName(/标为未读/);
  await expect(row.locator("[data-unread-mark]")).toBeVisible();
  await expect(row).toHaveAttribute("aria-pressed", "false");
  const marked = await box(row);
  expect(Math.abs(marked.height - before.height)).toBeLessThanOrEqual(1);
  if (testInfo.project.name === "mobile")
    measure(testInfo, `375x812: row ${before.height} px, marked unread ${marked.height} px`);
  // The dot is not an unread message: no count in the row, the page's line, or the tab's title.
  await expect(page.getByText("消息已全部读完")).toBeVisible();
  await expect(row.getByText(/^\d+$/)).toHaveCount(0);
  expect(await page.title()).not.toMatch(/^\(\d+\) /);

  // Kept on the server; the job seeker's 已读 is as it was.
  await page.reload();
  await expect(row.locator("[data-unread-mark]")).toBeVisible();
  await seeker.reload();
  await expect(read).toHaveText("已读");

  // Opening the chat takes the dot off, on the server too.
  await row.click();
  await expect(page.getByRole("log", { name: "消息记录" })).toContainText("你好，周末可以上班吗？");
  await backToList(page, testInfo);
  await expect(row.locator("[data-unread-mark]")).toHaveCount(0);
  await expect(row).not.toHaveAccessibleName(/标为未读/);
  await page.reload();
  await expect(row).toBeVisible();
  await expect(row.locator("[data-unread-mark]")).toHaveCount(0);

  // The job seeker's side has it too.
  await seeker.goto("/messages");
  const theirs = rows(seeker).first();
  await theirs.click();
  await seeker.getByRole("button", { name: /^更多：/ }).click();
  await seeker.getByRole("menuitem", { name: "标为未读" }).click();
  await expect(theirs.locator("[data-unread-mark]")).toBeVisible();
  await seeker.reload();
  await expect(theirs.locator("[data-unread-mark]")).toBeVisible();
  await seeker.context().close();
});
