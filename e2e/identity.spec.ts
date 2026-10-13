import { expect, test, type Page, type TestInfo } from "@playwright/test";

// A17: one account, two identities. Accounts live in the dev server's memory and the three demo businesses can
// each be claimed once per server, so every test uses fresh emails and new businesses; the demo-business test
// accepts either outcome for the first claim and checks the rule on the second.

const email = (testInfo: TestInfo, tag: string) =>
  `${tag}.${testInfo.project.name}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
const shop = (testInfo: TestInfo) => `测试面馆${testInfo.project.name === "mobile" ? "M" : "D"}${Date.now() % 1e6}`;

const accountButton = (page: Page) => page.getByRole("banner").getByRole("button", { name: /^账号菜单，当前身份：/ });

async function emailAndCode(page: Page, address: string) {
  await page.getByLabel("邮箱", { exact: true }).fill(address);
  await page.getByRole("button", { name: "获取验证码" }).click();
  await page.getByLabel("验证码").fill("123456");
  await page.getByRole("button", { name: "登录", exact: true }).click();
}

async function newBusiness(page: Page, name: string) {
  await expect(page.getByRole("heading", { name: "开通雇主身份" })).toBeVisible();
  await page.getByRole("radio", { name: /新建企业/ }).check();
  await page.getByLabel("店名", { exact: true }).fill(name);
  await page.getByRole("combobox", { name: /^地区/ }).selectOption({ label: "市中心" }); // its name also holds the chosen option
  await page.getByRole("button", { name: "开通并开始发布招聘" }).click();
}

async function signUpSeeker(page: Page, address: string) {
  await page.goto("/login");
  await expect(page.getByRole("radio", { name: /我要找工作/ })).toBeChecked();
  await emailAndCode(page, address);
  await expect(page).toHaveURL("/jobs");
}

async function signUpEmployer(page: Page, address: string, name: string) {
  await page.goto("/login?role=employer&next=%2Femployer%2Fpost");
  await emailAndCode(page, address);
  await newBusiness(page, name);
  await expect(page).toHaveURL("/employer/post");
}

test("a job seeker signs up and lands on the list as 求职者", async ({ page }, testInfo) => {
  await signUpSeeker(page, email(testInfo, "seeker"));
  await expect(accountButton(page)).toHaveAccessibleName("账号菜单，当前身份：求职者");
  await accountButton(page).click();
  await expect(page.getByRole("link", { name: "开通雇主身份" })).toBeVisible();
  await expect(page.getByRole("button", { name: /切换为/ })).toHaveCount(0);

  await page.goto("/me");
  await expect(page.getByText("当前身份：求职者").filter({ visible: true })).toBeVisible();
});

test("发布招聘 when signed out: employer sign-up with a new business, then posting as that employer", async ({
  page,
}, testInfo) => {
  const name = shop(testInfo);
  await page.goto("/jobs");
  await page.getByRole("banner").getByRole("link", { name: "发布招聘" }).click();
  await expect(page).toHaveURL("/login?role=employer&next=%2Femployer%2Fpost");
  await expect(page.getByRole("radio", { name: /我要招人/ })).toBeChecked();
  await emailAndCode(page, email(testInfo, "boss"));
  await newBusiness(page, name);
  await expect(page).toHaveURL("/employer/post");
  await expect(accountButton(page)).toHaveAccessibleName(`账号菜单，当前身份：雇主 · ${name}`);
});

test("demo businesses: the list, and each can belong to only one account", async ({ page, browser }, testInfo) => {
  await page.goto("/login?role=employer");
  await emailAndCode(page, email(testInfo, "demo"));
  for (const name of ["川味小馆", "北岸早茶酒家", "悦美发型工作室"]) {
    await expect(page.getByRole("radio", { name: new RegExp(name) })).toBeVisible();
  }
  await page.getByRole("radio", { name: /川味小馆/ }).check();
  await page.getByRole("button", { name: "开通并开始发布招聘" }).click();
  // Free on a fresh server; already claimed if these tests ran before on the same server.
  const refused = page.getByRole("main").getByRole("alert");
  const claimedHere = accountButton(page).and(
    page.getByRole("button", { name: "账号菜单，当前身份：雇主 · 川味小馆" }),
  );
  await expect(refused.or(claimedHere)).toBeVisible();
  if (await refused.isVisible()) {
    await expect(refused).toContainText("已被其他账号绑定");
  } else {
    await expect(page).toHaveURL("/employer/post");
  }

  // By now 川味小馆 is claimed, so another account cannot take it.
  const other = await browser.newPage();
  await other.goto("/login?role=employer");
  await emailAndCode(other, email(testInfo, "demo2"));
  await other.getByRole("radio", { name: /川味小馆/ }).check();
  await other.getByRole("button", { name: "开通并开始发布招聘" }).click();
  await expect(other.getByRole("main").getByRole("alert")).toContainText("已被其他账号绑定");
  await expect(other).toHaveURL(/\/login/);
  await other.close();
});

test("a signed-in job seeker opens the employer identity from the account menu", async ({ page }, testInfo) => {
  const name = shop(testInfo);
  await signUpSeeker(page, email(testInfo, "upgrade"));
  await accountButton(page).click();
  await page.getByRole("link", { name: "开通雇主身份" }).click();
  await expect(page).toHaveURL("/login?role=employer&next=%2Femployer%2Fpost");
  await newBusiness(page, name); // straight to the business step: no email step
  await expect(page.getByLabel("邮箱", { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL("/employer/post");
  await expect(accountButton(page)).toHaveAccessibleName(`账号菜单，当前身份：雇主 · ${name}`);
});

test("a signed-in job seeker without a business: 发布招聘 goes to the business step", async ({ page }, testInfo) => {
  await signUpSeeker(page, email(testInfo, "nobiz"));
  await page.getByRole("banner").getByRole("link", { name: "发布招聘" }).click();
  await expect(page).toHaveURL("/login?role=employer&next=%2Femployer%2Fpost");
  await expect(page.getByRole("heading", { name: "开通雇主身份" })).toBeVisible();
});

test("switching between the two identities from the account menu", async ({ page }, testInfo) => {
  const name = shop(testInfo);
  await signUpEmployer(page, email(testInfo, "switch"), name);

  await accountButton(page).click();
  await page.getByRole("button", { name: "切换为求职者" }).click();
  await expect(page).toHaveURL("/workspace");
  await expect(page.getByRole("heading", { name: "求职者工作台", level: 1 })).toBeVisible();
  await expect(accountButton(page)).toHaveAccessibleName("账号菜单，当前身份：求职者");

  await accountButton(page).click();
  await page.getByRole("button", { name: `切换为雇主（${name}）` }).click();
  await expect(page).toHaveURL("/workspace");
  await expect(page.getByRole("heading", { name: "雇主工作台", level: 1 })).toBeVisible();
  await expect(accountButton(page)).toHaveAccessibleName(`账号菜单，当前身份：雇主 · ${name}`);
});

test("an employer signing in again goes straight to posting; as a job seeker, 发布招聘 switches", async ({
  page,
}, testInfo) => {
  const name = shop(testInfo);
  const address = email(testInfo, "again");
  await signUpEmployer(page, address, name);
  await accountButton(page).click();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page.getByRole("banner").getByRole("link", { name: "登录 / 注册" })).toBeVisible();

  // As an employer: no business step this time.
  await page.goto("/login?role=employer");
  await emailAndCode(page, address);
  await expect(page).toHaveURL("/employer/post");
  await expect(accountButton(page)).toHaveAccessibleName(`账号菜单，当前身份：雇主 · ${name}`);
  await accountButton(page).click();
  await page.getByRole("button", { name: "退出登录" }).click();

  // As a job seeker: the business is still there; 发布招聘 switches to it.
  await page.goto("/login");
  await emailAndCode(page, address);
  await expect(page).toHaveURL("/jobs");
  await expect(accountButton(page)).toHaveAccessibleName("账号菜单，当前身份：求职者");
  const post = page.getByRole("banner").getByRole("link", { name: "发布招聘" });
  await expect(post).toHaveAttribute("href", "/employer/post");
  await post.click();
  await expect(page).toHaveURL("/employer/post");
  await expect(accountButton(page)).toHaveAccessibleName(`账号菜单，当前身份：雇主 · ${name}`);
});

test("the browser's copy cannot turn an account into an employer: the server corrects it", async ({
  page,
}, testInfo) => {
  const address = email(testInfo, "tamper");
  await signUpSeeker(page, address);
  await page.evaluate((a) => {
    localStorage.setItem(
      "zhaogong:session",
      JSON.stringify({
        email: a,
        signedInAt: new Date().toISOString(),
        activeRole: "employer",
        employerId: "e7",
        employerName: "快达物流",
      }),
    );
  }, address);
  await page.reload();
  await expect(accountButton(page)).toHaveAccessibleName("账号菜单，当前身份：求职者");
  await accountButton(page).click();
  await expect(page.getByRole("link", { name: "开通雇主身份" })).toBeVisible();
  await expect(page.getByRole("button", { name: /切换为雇主/ })).toHaveCount(0);
});
