// E5-3 (brief-A-E5-3.md, a-ed3d/e5/audit.md): 约面试 on a phone opens in the bottom sheet, 发出邀约 fixed at its foot.
// New measures of their own (boundingBox, as A21 measures); A21 is not changed by them.
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { chatAboutJob, freshEmail, signIn } from "./helpers";
import { candidateCard, publishJob, signUpEmployer, uniqueTitle } from "./employer/helpers";

const box = async (locator: Locator) => (await locator.boundingBox())!;

/** A measure, in the report and in the gate's log. */
function measure(testInfo: TestInfo, annotation: { type: string; description: string }) {
  testInfo.annotations.push(annotation);
  console.log(`${annotation.type}: ${annotation.description}`);
}

/** The sheet slides up (animate-sheet-up); measure it once it has come to rest. */
const settled = (locator: Locator) =>
  locator.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((a) => a.finished)));

async function inView(page: Page, locator: Locator) {
  const b = await box(locator);
  const height = page.viewportSize()!.height;
  expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.y + b.height).toBeLessThanOrEqual(height);
  return b;
}

test("E5-3 约面试 on a phone: a bottom sheet, 发出邀约 in view, 收起 finger sized, the keyboard up, Esc and a tap outside send nothing", async ({
  page,
  browser,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "the phone's screen");
  await signUpEmployer(page, testInfo, "/workspace", { demo: true });
  const jobId = (await publishJob(page, uniqueTitle("手机约面试服务员", testInfo)))!;
  const context = await browser.newContext({ ...testInfo.project.use });
  const seeker = await context.newPage();
  await signIn(seeker, `/jobs/${jobId}`, freshEmail("e2e.e5.sheet"));
  await chatAboutJob(seeker, jobId, "请问可以先面试吗？");
  await context.close();

  const card = await candidateCard(page, jobId);
  const invite = card.getByRole("button", { name: "约面试" });
  const sheet = page.getByRole("dialog", { name: "约求职者面试" });
  const send = sheet.getByRole("button", { name: "发出邀约" });

  // 1. 发出邀约 is on the screen without scrolling (it was at y ≈ 1169 in the card).
  await invite.click();
  await expect(sheet).toBeVisible();
  await settled(sheet);
  await expect(sheet.getByRole("form", { name: "约求职者面试" }).locator(":focus")).toHaveCount(1);
  const sendBox = await inView(page, send);
  measure(testInfo, {
    type: "E5-3",
    description: `375x812: 发出邀约 at y ${sendBox.y}–${sendBox.y + sendBox.height}`,
  });

  // 2. 收起 and the sheet's 关闭 are at least 44 × 44.
  for (const name of ["收起", "关闭"]) {
    const b = await box(sheet.getByRole("button", { name, exact: true }));
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }

  // 3. The keyboard up (375 × 476): the field being typed in and 发出邀约 are both on the screen.
  await page.setViewportSize({ width: 375, height: 476 });
  const note = sheet.getByLabel("附言（选填）");
  await note.focus();
  await note.fill("带上简历");
  const noteBox = await inView(page, note);
  const sendUp = await inView(page, send);
  measure(testInfo, {
    type: "E5-3",
    description: `375x476: 附言 at y ${noteBox.y}, 发出邀约 at y ${sendUp.y}`,
  });
  await page.setViewportSize({ width: 375, height: 812 });

  // 4. Esc closes it, nothing sent, the focus back on 约面试; the same for a tap outside the sheet.
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(invite).toBeFocused();
  await invite.click();
  await expect(sheet).toBeVisible();
  await page.mouse.click(187, 20); // the dimmed page above the sheet
  await expect(sheet).toBeHidden();
  await expect(invite).toBeFocused();
  await expect(card.getByRole("status", { name: "和求职者的面试" })).toHaveCount(0);

  // 收起 too; then sending from the footer works.
  await invite.click();
  await sheet.getByRole("button", { name: "收起", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(invite).toBeFocused();
  await invite.click();
  await sheet.getByRole("radio", { name: "电话联系后再定" }).check();
  await send.click();
  await expect(sheet).toBeHidden();
  await expect(card.getByRole("status", { name: "和求职者的面试" })).toContainText("已发邀约");
});
