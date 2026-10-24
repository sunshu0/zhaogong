import { expect, test, type Page } from "@playwright/test";
import { openFromList } from "./helpers";

// #171: going into a job and back, the page content slides (a View Transition); with "reduce motion" nothing moves.
// The page records each view transition: the types React started it with (a navigation's nav-forward / nav-back)
// and the names of the animations running once it is ready. Other view transitions come in between (a Suspense
// boundary showing its content starts one too), so a navigation's is found by its type, not by its place.
type Recorded = { types: string[]; animations: string[] | null };

async function recordTransitions(page: Page) {
  await page.addInitScript(() => {
    const record: Recorded[] = [];
    (window as unknown as { transitions: Recorded[] }).transitions = record;
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((arg: Parameters<typeof start>[0]) => {
      const transition = start(arg);
      const entry: Recorded = { types: typeof arg === "object" && arg.types ? [...arg.types] : [], animations: null };
      record.push(entry);
      transition.ready.then(
        () => (entry.animations = document.getAnimations().map((a) => (a as CSSAnimation).animationName ?? "")),
        () => (entry.animations = ["skipped"]),
      );
      return transition;
    }) as typeof document.startViewTransition;
  });
}

/** The animations of the view transition of this type, once it is ready. */
async function animationsOf(page: Page, type: string) {
  const ofType = () =>
    page.evaluate(
      (type) =>
        (window as unknown as { transitions: Recorded[] }).transitions.find((t) => t.types.includes(type))
          ?.animations ?? null,
      type,
    );
  await expect.poll(ofType, { message: `a view transition of type ${type}` }).not.toBeNull();
  return (await ofType()) ?? [];
}

async function intoAJobAndBack(page: Page) {
  await page.goto("/jobs");
  // From 1280 px a card shows the job beside the list (#376); 查看完整页面 opens it, the same forward transition.
  await openFromList(page, page.locator('a[href^="/jobs/j"]').filter({ visible: true }).first());
  const forward = await animationsOf(page, "nav-forward");
  await page.getByRole("link", { name: "职位列表" }).click();
  await expect(page).toHaveURL(/\/jobs$/);
  const back = await animationsOf(page, "nav-back");
  return [forward, back];
}

test("into a job and back, the content slides", async ({ page }) => {
  await recordTransitions(page);
  const [forward, back] = await intoAJobAndBack(page);
  expect(forward).toContain("page-slide");
  expect(back).toContain("page-slide");
});

test("with reduce motion nothing animates between pages", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordTransitions(page);
  const [forward, back] = await intoAJobAndBack(page);
  expect(forward.filter((name) => name.startsWith("page-"))).toEqual([]);
  expect(back.filter((name) => name.startsWith("page-"))).toEqual([]);
});
