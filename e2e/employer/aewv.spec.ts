import { expect, test } from "@playwright/test";
import { CLEAN_MESSAGE, openTheForm, signUpEmployer } from "./helpers";

test("a business that is not accredited is not offered AEWV holders, and a pasted one is blocked", async ({
  page,
}, testInfo) => {
  await signUpEmployer(page, testInfo); // a new business: unverified
  await openTheForm(page);
  await page.getByLabel(/把微信群里的招聘消息粘贴进来/).fill(CLEAN_MESSAGE);
  await page.getByRole("button", { name: "整理成职位" }).click();
  const visas = page.getByRole("group", { name: /可接受的签证/ });
  await expect(visas.getByRole("checkbox", { name: "学签" })).toBeChecked();
  await expect(visas.getByRole("checkbox", { name: "持 AEWV 工签者" })).toHaveCount(0);

  // Pasted in anyway: the chip shows so it can be taken off, and the check blocks it until then.
  await page.goto("/employer/post");
  await openTheForm(page);
  await page
    .getByLabel(/把微信群里的招聘消息粘贴进来/)
    .fill("Mt Eden 川菜馆招前厅服务员，时薪 $25-27，每周 15-25 小时，包工作餐，学签和雇主担保工签可，需会普通话。");
  await page.getByRole("button", { name: "整理成职位" }).click();
  await expect(visas.getByRole("checkbox", { name: "持 AEWV 工签者" })).toBeChecked();
  await expect(page.getByText(/只有认证雇主（Accredited Employer）才能招/).first()).toBeVisible();
  // Taken off, the chip goes: this business cannot offer it.
  await visas.getByRole("checkbox", { name: "持 AEWV 工签者" }).click();
  await expect(page.getByText(/只有认证雇主（Accredited Employer）才能招/)).toHaveCount(0);
  await expect(visas.getByRole("checkbox", { name: "持 AEWV 工签者" })).toHaveCount(0);
});
