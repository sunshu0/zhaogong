import { expect, test } from "@playwright/test";
import { expectProfileSaved, freshEmail, signIn } from "./helpers";
import AxeBuilder from "@axe-core/playwright";
import { signUpEmployer } from "./employer/helpers";

// Round 19 pages pop in and fade (animate-pop-in, transitions): axe scans the settled page, as with "reduce motion",
// not one caught mid-animation with half-faded colours.
test.use({ reducedMotion: "reduce" });

test("chat header avatar and employer name both open the company home", async ({ page }, testInfo) => {
  await signIn(page, "/messages?conversation=north-tea", freshEmail("demo.chat-profile"));
  const header = page.getByRole("region", { name: "与北岸早茶酒家的聊天" });
  const profile = header.getByRole("link", { name: "查看北岸早茶酒家的主页", exact: true });
  await expect(profile).toHaveAttribute("href", "/employers/e2");
  await profile.locator("span").first().click();
  await expect(page).toHaveURL("/employers/e2");
  await expect(page.getByRole("heading", { name: "北岸早茶酒家", exact: true })).toBeVisible();
  await page.goBack();
  await profile.getByRole("heading", { name: "北岸早茶酒家", exact: true }).click();
  await expect(page).toHaveURL("/employers/e2");
  await page.goBack();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("chat-profile-entry.png"), fullPage: true });
});

test("employer opens candidate home, including legacy local chats and withdrawn public profiles", async ({
  page,
  browser,
}, testInfo) => {
  // A job seeker who allows 推荐人才, in another browser (#104: the page is on their account). The page is put into
  // that browser first, as one filled in before signing in would be, and goes to the account on the first visit.
  const candidateId = `public-demo-${Date.now() % 1_000_000}`;
  const seeker = await (await browser.newContext({ viewport: page.viewportSize() ?? undefined })).newPage();
  const seekerEmail = await signIn(seeker, "/", freshEmail("public.profile"));
  await seeker.evaluate(
    ([email, candidateId]) => {
      const scope = JSON.stringify([email, "seeker", null]);
      const page = {
        name: "公开求职者",
        contactName: "",
        headline: "前厅服务",
        location: "奥克兰",
        languages: "普通话",
        availability: "周末",
        bio: "公开个人介绍",
        privateDetails: { phone: "PRIVATE-PHONE", wechat: "PRIVATE-WECHAT", email: "PRIVATE-EMAIL" },
        resume: { candidateId, discoverable: true, skills: "收银", employmentTypes: ["part_time"], regionIds: [] },
      };
      localStorage.setItem(
        "zhaogong:profiles-by-identity",
        JSON.stringify({ version: 2, identities: { [scope]: page } }),
      );
    },
    [seekerEmail, candidateId] as const,
  );
  await seeker.goto("/profile");
  await expectProfileSaved(seeker);

  // A chat that only this browser had from before #10 is handed to the server on the first sync, when the server
  // has nothing for the employer yet; so it comes first, before anything else is sent.
  await signUpEmployer(page, testInfo, "/profile", { demo: true });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const session = JSON.parse(localStorage.getItem("zhaogong:session")!);
        const scope = JSON.stringify([session.email, "employer", session.employerId]);
        return Boolean(JSON.parse(localStorage.getItem("zhaogong:chat-demo") ?? "{}").identities?.[scope]);
      }),
    )
    .toBe(true);
  await page.evaluate((candidateId) => {
    const session = JSON.parse(localStorage.getItem("zhaogong:session")!);
    const scope = JSON.stringify([session.email, "employer", session.employerId]);
    const key = "zhaogong:chat-demo";
    const stored = JSON.parse(localStorage.getItem(key) ?? '{"version":2,"identities":{}}');
    const id = `recommend:local-${candidateId}:j1`;
    stored.identities[scope] ??= { added: {}, readAt: {}, extra: [], exchanges: {}, reports: [] };
    stored.identities[scope].extra = [
      { id, person: "公开求职者", title: "服务员", avatar: "公", time: "刚刚", job: "j1" },
    ];
    localStorage.setItem(key, JSON.stringify(stored));
  }, candidateId);
  await page.goto(`/messages?conversation=${encodeURIComponent(`recommend:local-${candidateId}:j1`)}`);
  await page.getByRole("link", { name: "查看公开求职者的主页", exact: true }).click();
  await expect(page).toHaveURL(`/candidates/local-${candidateId}`);
  await expect(page.getByRole("heading", { name: "公开求职者", exact: true })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("PRIVATE-");
  // The job seeker withdraws it; the employer's next visit no longer shows it.
  await seeker.getByLabel("允许向雇主推荐我的主页").uncheck();
  await expectProfileSaved(seeker);
  await seeker.context().close();
  await page.reload();
  await expect(page.getByRole("heading", { name: "求职者主页暂不可查看", exact: true })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("公开个人介绍");
  await page.goto("/candidates/missing");
  await expect(page.getByRole("heading", { name: "求职者主页暂不可查看", exact: true })).toBeVisible();

  await page.goto("/messages?conversation=candidate-lin");
  const profile = page.getByRole("link", { name: "查看林晓的主页", exact: true });
  await profile.locator("span").first().click();
  await expect(page).toHaveURL("/candidates/candidate-lin");
  await expect(page.getByRole("heading", { name: "林晓", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "公开求职资料", exact: true })).toContainText("点餐");
  expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("candidate-home.png"), fullPage: true });
  await page.getByRole("link", { name: "回到聊天", exact: true }).click();
  await expect(page).toHaveURL("/messages?conversation=candidate-lin");
  await profile.getByRole("heading", { name: "林晓", exact: true }).click();
  await expect(page).toHaveURL("/candidates/candidate-lin");
});
