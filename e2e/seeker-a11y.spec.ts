import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { freshEmail, selectTrigger, signIn } from "./helpers";
import { waitForTitle } from "./helpers/title";

// Accessibility of the job seeker's pages that no other spec checks with axe after Round 19 (#166): 收藏和进度 in
// its three states, and the cards for pages that are not there (#161). Phone and desktop (both projects).
// Reduced motion: the 进度 dropdown fades in (animate-pop-in), and axe measured its options' contrast mid-fade.
test.use({ reducedMotion: "reduce" });
async function expectNoViolations(page: Page, state: string) {
  await waitForTitle(page);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const found = violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n${v.nodes.map((n) => `    ${n.target.join(" ")} — ${n.failureSummary?.split("\n").join(" ")}`).join("\n")}`,
  );
  expect.soft(found, `${state}\n${found.join("\n")}`).toEqual([]);
}

test("收藏和进度: empty, with a saved job, and with 进度 open", async ({ page }) => {
  await signIn(page, "/me/saved", freshEmail("a11y.saved"));
  await expect(page.getByText("还没有收藏的职位")).toBeVisible();
  await expectNoViolations(page, "/me/saved empty");

  await page.goto("/jobs/j3");
  const save = page.getByRole("button", { name: "收藏：点心师傅", exact: true }).filter({ visible: true });
  await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(save).not.toHaveAttribute("aria-busy");
  await page.goto("/me/saved");
  const job = page.getByRole("list", { name: "收藏的职位" }).getByRole("article", { name: "点心师傅" });
  await expect(selectTrigger(job, "进度")).toHaveAccessibleName("进度 已收藏");
  await expectNoViolations(page, "/me/saved with a job");

  // A bottom sheet on phones, a dropdown from 768px: both are the listbox named after the field.
  await selectTrigger(job, "进度").click();
  await expect(page.getByRole("listbox", { name: "进度", exact: true })).toBeVisible();
  await expectNoViolations(page, "/me/saved with 进度 open");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox", { name: "进度", exact: true })).toBeHidden();
});

test("the cards for pages that are not there", async ({ page }) => {
  const pages: [string, string][] = [
    ["/no-such-page", "这个页面不存在"],
    [`/external/${encodeURIComponent("demo-kowhai:4002")}`, "这个页面不存在"],
    ["/jobs/no-such-job", "这个职位不存在或已下架"],
    ["/employers/no-such-employer", "这个雇主不存在或已停用"],
  ];
  for (const [path, heading] of pages) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expectNoViolations(page, path);
  }
});
