// When an employer page's Server Function calls get no answer (no network, the server restarting): a list or card that
// could not be loaded says so in its place, with 重试, instead of waiting on its skeleton for good (#246); an action
// says so where it was pressed and keeps what was typed, instead of giving way to the error page (#247). The tests cut
// the network for the page's Server Function calls (POSTs to its own path); the page and its scripts still load.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "../helpers";
import { CLEAN_MESSAGE, openTheForm, publishJob, signUpEmployer, uniqueTitle } from "./helpers";

test.use({ reducedMotion: "reduce" });

/** Cuts the Server Function calls made from `path` while `cut.on` is true. */
async function cutCalls(page: Page, path: string) {
  const cut = { on: false };
  await page.route(
    (url) => url.pathname === path,
    (route) => (cut.on && route.request().method() === "POST" ? route.abort("internetdisconnected") : route.fallback()),
  );
  return cut;
}

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(violations).toEqual([]);
}

test("employer lists that get no answer say so in their place, and 重试 asks again (#246)", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo, "/employer/jobs");
  await expect(page.getByRole("heading", { name: "职位管理" })).toBeVisible();

  for (const [path, words, back] of [
    ["/employer/jobs", "职位没取到", page.getByText("还没有发布过职位。")],
    ["/employer/team", "团队没取到", page.getByRole("heading", { name: "团队", exact: true })],
    ["/employer/verify", "企业验证没取到", page.getByRole("heading", { name: "1. 在企业登记里找到你的公司" })],
  ] as const) {
    const cut = await cutCalls(page, path);
    cut.on = true;
    await page.goto(path);
    const failed = page.getByRole("alert").filter({ hasText: words });
    await expect(failed).toBeVisible();
    await expectNoViolations(page);

    cut.on = false;
    await failed.getByRole("button", { name: "重试" }).click();
    await expect(failed).toHaveCount(0);
    await expect(back).toBeVisible();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});

test("employer actions that get no answer say so where they were pressed, keep what was typed, and work again (#247)", async ({
  page,
  browser,
}, testInfo) => {
  // Someone to invite: an account that signed in once (the team's rule).
  const staff = await browser.newPage();
  const staffEmail = await signIn(staff, "/account");
  await staff.context().close();

  await signUpEmployer(page, testInfo, "/employer/team");
  const noAnswer = "网络有问题，请稍后再试。";
  // The team page says it in role=alert; 查询 and 整理成职位 in a line of their own.
  const said = page.getByRole("alert").filter({ hasText: noAnswer });

  // 团队: the invited email stays, and the same press works once the network is back.
  let cut = await cutCalls(page, "/employer/team");
  const invitee = page.getByLabel("对方的邮箱");
  const send = page.getByRole("button", { name: "发送邀请" });
  await invitee.fill(staffEmail);
  cut.on = true;
  await send.click();
  await expect(said).toBeVisible();
  await expect(page.getByRole("heading", { name: "团队", exact: true })).toBeVisible();
  await expect(invitee).toHaveValue(staffEmail);
  await expect(send).toBeEnabled();
  await expectNoViolations(page);
  cut.on = false;
  await send.click();
  await expect(page.getByRole("status")).toContainText(`已邀请 ${staffEmail}`);
  await expect(said).toHaveCount(0);
  await expect(invitee).toHaveValue("");
  await page.unrouteAll({ behavior: "ignoreErrors" });

  // 企业验证: the search stays, and the form says so where the results would be.
  cut = await cutCalls(page, "/employer/verify");
  await page.goto("/employer/verify");
  const query = page.getByLabel("公司名称或 NZBN");
  const search = page.getByRole("button", { name: "查询" });
  await query.fill("9429999000000");
  cut.on = true;
  await search.click();
  await expect(page.getByText(noAnswer)).toBeVisible();
  await expect(query).toHaveValue("9429999000000");
  await expect(search).toBeEnabled();
  cut.on = false;
  await search.click();
  await expect(page.getByRole("button", { name: "这是我的公司" })).toBeVisible();
  await expect(page.getByText(noAnswer)).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });

  // 发布招聘: the pasted message stays on its step.
  cut = await cutCalls(page, "/employer/post");
  await page.goto("/employer/post");
  await openTheForm(page);
  const pasted = page.getByLabel(/把微信群里的招聘消息粘贴进来/);
  await pasted.fill(CLEAN_MESSAGE);
  const tidy = page.getByRole("button", { name: "整理成职位" });
  cut.on = true;
  await tidy.click();
  await expect(page.getByText(noAnswer)).toBeVisible();
  await expect(pasted).toHaveValue(CLEAN_MESSAGE);
  await expect(tidy).toBeEnabled();
  cut.on = false;
  await tidy.click();
  await expect(page.getByLabel("职位名称（中文）")).toBeVisible();
  await expect(page.getByText(noAnswer)).toHaveCount(0);
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("推荐人才 says when the candidates with accounts got no answer, with 重试, and shows them once they come (#277)", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo);
  await publishJob(page, uniqueTitle("前厅服务员", testInfo));
  // Only the directory's call is cut: it takes no arguments (its body is []), the jobs' call carries its options.
  let cut = true;
  await page.route(
    (url) => url.pathname === "/employer/candidates",
    (route) =>
      cut && route.request().method() === "POST" && route.request().postData() === "[]"
        ? route.abort("internetdisconnected")
        : route.fallback(),
  );
  await page.goto("/employer/candidates");
  const failed = page.getByRole("alert").filter({ hasText: "账号上的人选没取到" });
  await expect(failed).toBeVisible();
  // The rest of the page is there (the examples are still listed), and nothing says the list is all there is.
  const title = page.getByText(/^推荐求职者 · \d+ 人$/);
  await expect(title).toBeVisible();
  await expect(page.getByText("暂无符合条件的求职者")).toHaveCount(0);
  await expectNoViolations(page);

  cut = false;
  await failed.getByRole("button", { name: "重试" }).click();
  await expect(failed).toHaveCount(0);
  await expect(title).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
});
