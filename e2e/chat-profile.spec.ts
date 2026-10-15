import { expect, test } from "@playwright/test";
import { freshEmail, signIn } from "./helpers";
import AxeBuilder from "@axe-core/playwright";
import { signUpEmployer } from "./employer/helpers";

test("chat header avatar and employer name both open the company home", async ({ page }, testInfo) => {
  await signIn(page, "/messages?conversation=north-tea", freshEmail("chat-profile"));
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
}, testInfo) => {
  // A chat that only this browser had from before #10 is handed to the server on the first sync, when the server
  // has nothing for the employer yet; so it comes first, before anything else is sent.
  await signUpEmployer(page, testInfo, "/profile");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const session = JSON.parse(localStorage.getItem("zhaogong:session")!);
        const scope = JSON.stringify([session.email, "employer", session.employerId]);
        return Boolean(JSON.parse(localStorage.getItem("zhaogong:chat-demo") ?? "{}").identities?.[scope]);
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem("zhaogong:session")!);
    const scope = JSON.stringify([session.email, "employer", session.employerId]);
    const key = "zhaogong:chat-demo";
    const stored = JSON.parse(localStorage.getItem(key) ?? '{"version":2,"identities":{}}');
    const id = "recommend:local-public-demo:j1";
    stored.identities[scope] ??= { added: {}, readAt: {}, extra: [], exchanges: {}, reports: [] };
    stored.identities[scope].extra = [
      { id, person: "公开求职者", title: "服务员", avatar: "公", time: "刚刚", job: "j1" },
    ];
    localStorage.setItem(key, JSON.stringify(stored));
    const profileScope = JSON.stringify(["public-profile@example.com", "seeker", null]);
    localStorage.setItem(
      "zhaogong:profiles-by-identity",
      JSON.stringify({
        [profileScope]: {
          name: "公开求职者",
          contactName: "",
          headline: "前厅服务",
          location: "奥克兰",
          languages: "普通话",
          availability: "周末",
          bio: "公开个人介绍",
          privateDetails: {
            phone: "PRIVATE-PHONE",
            wechat: "PRIVATE-WECHAT",
            email: "PRIVATE-EMAIL",
            address: "PRIVATE-ADDRESS",
          },
          resume: {
            candidateId: "public-demo",
            discoverable: true,
            skills: "收银",
            employmentTypes: ["part_time"],
            regionIds: [],
          },
        },
      }),
    );
  });
  await page.goto("/messages?conversation=recommend%3Alocal-public-demo%3Aj1");
  await page.getByRole("link", { name: "查看公开求职者的主页", exact: true }).click();
  await expect(page).toHaveURL("/candidates/local-public-demo");
  await expect(page.getByRole("heading", { name: "公开求职者", exact: true })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("PRIVATE-");
  await page.evaluate(() => {
    const key = "zhaogong:profiles-by-identity";
    const stored = JSON.parse(localStorage.getItem(key)!);
    for (const item of Object.values(stored.identities ?? stored) as { resume: { discoverable: boolean } }[])
      item.resume.discoverable = false;
    localStorage.setItem(key, JSON.stringify(stored));
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });
  await expect(page.getByRole("heading", { name: "求职主页暂不可查看", exact: true })).toBeVisible();
  await expect(page.getByRole("main")).not.toContainText("公开个人介绍");
  await page.goto("/candidates/missing");
  await expect(page.getByRole("heading", { name: "求职主页暂不可查看", exact: true })).toBeVisible();

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
