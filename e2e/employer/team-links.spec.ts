// 团队邀请链接 (#349, ADR 0028): an admin makes a link for WeChat and the like; someone new signs up through it and
// joins, someone signed in joins at once; a used, revoked, expired, mistyped link, or an account with a business of
// its own, gets a clear answer instead.
import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { fillSignInCode, freshEmail, signIn } from "../helpers";
import { signUpEmployer } from "./helpers";

/** On /employer/team as an admin: makes a link and returns it as shown (the only time it is shown). */
async function makeLink(page: Page): Promise<string> {
  await page.getByRole("button", { name: "生成邀请链接" }).click();
  await expect(page.getByRole("heading", { name: "新的邀请链接" })).toBeFocused();
  const url = await page.getByRole("textbox", { name: "邀请链接" }).inputValue();
  expect(url).toMatch(/\/employer\/team\/join\/[A-Za-z0-9_-]{43}$/);
  return new URL(url).pathname;
}

async function newBrowser(browser: Browser, testInfo: TestInfo): Promise<Page> {
  const context = await browser.newContext({ ...testInfo.project.use });
  return context.newPage();
}

/** The join page's answer when the link cannot be used. */
function refusal(page: Page) {
  return page.getByRole("main");
}

test("someone new signs up through the link and joins as a member; the link then works no more", async ({
  page,
  browser,
}, testInfo) => {
  const shop = await signUpEmployer(page, testInfo, "/employer/team");
  const path = await makeLink(page);
  await expect(page.getByRole("region", { name: "还没用掉的链接" }).getByRole("listitem")).toHaveCount(1);

  // Signed out: the business invites, and 登录后加入 goes through sign-in (a new email signs up) and back.
  const newcomer = await newBrowser(browser, testInfo);
  await newcomer.goto(path);
  await expect(newcomer.getByRole("heading", { name: "加入团队" })).toBeVisible();
  await expect(newcomer.getByText(`${shop} 邀请你加入团队，身份是成员`)).toBeVisible();
  await newcomer.getByRole("link", { name: "登录后加入" }).click();
  await expect(newcomer).toHaveURL(/\/login\?next=/);
  await newcomer.getByLabel("邮箱", { exact: true }).fill(freshEmail("demo.e2e.link"));
  await newcomer.getByRole("button", { name: "获取验证码" }).click();
  await fillSignInCode(newcomer);
  await newcomer.getByRole("button", { name: "登录", exact: true }).click();
  await expect(newcomer).toHaveURL(path);
  await newcomer.getByLabel(/你在团队里的称呼/).fill("小李");
  await newcomer.getByRole("button", { name: "加入团队" }).click();
  await expect(newcomer).toHaveURL("/employer/team");
  await expect(newcomer.getByRole("listitem", { name: "小李，成员" })).toBeVisible();
  // Members neither make nor see links.
  await expect(newcomer.getByRole("button", { name: "生成邀请链接" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("listitem", { name: "小李，成员" })).toBeVisible();
  await expect(page.getByRole("region", { name: "还没用掉的链接" })).toHaveCount(0);

  // Used once: the next person is told so.
  const late = await newBrowser(browser, testInfo);
  await late.goto(path);
  await expect(refusal(late)).toContainText("这条邀请链接已经用过了");
  await newcomer.context().close();
  await late.context().close();
});

test("someone signed in joins at once; an account with its own business is refused and the link stays open", async ({
  page,
  browser,
}, testInfo) => {
  await signUpEmployer(page, testInfo, "/employer/team");
  const path = await makeLink(page);

  // The boss of another business.
  const other = await newBrowser(browser, testInfo);
  await signUpEmployer(other, testInfo, "/employer/team");
  await other.goto(path);
  await expect(refusal(other)).toContainText("你的账号已经属于一家企业");

  // An account without a business, already signed in: the form at once, with who is signed in.
  const seeker = await newBrowser(browser, testInfo);
  const email = await signIn(seeker, "/account", freshEmail("demo.e2e.link"));
  await seeker.goto(path);
  await expect(seeker.getByText(`你现在登录的是 ${email}。`)).toBeVisible();
  await seeker.getByLabel(/你在团队里的称呼/).fill("小王");
  await seeker.getByRole("button", { name: "加入团队" }).click();
  await expect(seeker).toHaveURL("/employer/team");
  await expect(seeker.getByRole("listitem", { name: "小王，成员" })).toBeVisible();

  // Opening it again as a member of the team says so.
  await seeker.goto(path);
  await expect(refusal(seeker)).toContainText("你已经在这家店的团队里了");
  await other.context().close();
  await seeker.context().close();
});

test("a revoked, an expired and a mistyped link each say why they do not work", async ({ page, browser }, testInfo) => {
  await signUpEmployer(page, testInfo, "/employer/team");
  const revoked = await makeLink(page);
  const open = page.getByRole("region", { name: "还没用掉的链接" });
  await open.getByRole("button", { name: "撤销链接" }).click();
  await expect(page.getByRole("status")).toHaveText("链接已撤销。");
  await expect(open).toHaveCount(0);

  const expired = await makeLink(page);
  const token = expired.split("/").pop();
  const aged = await page.request.post("/api/dev/team-link-age", { data: { token, days: 8 } });
  expect(aged.status()).toBe(200);
  await page.reload();
  await expect(page.getByRole("region", { name: "还没用掉的链接" })).toContainText("已过期");

  const visitor = await newBrowser(browser, testInfo);
  await visitor.goto(revoked);
  await expect(refusal(visitor)).toContainText("这条邀请链接已经被管理员撤销了");
  await visitor.goto(expired);
  await expect(refusal(visitor)).toContainText("这条邀请链接已经过期（7 天内有效）");
  await visitor.goto(`${expired.slice(0, -3)}xyz`);
  await expect(refusal(visitor)).toContainText("这条邀请链接不对");
  await expect(refusal(visitor)).not.toContainText("测试店");
  await visitor.context().close();
});
