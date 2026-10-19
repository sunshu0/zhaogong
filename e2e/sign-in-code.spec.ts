import { expect, test } from "@playwright/test";
import { freshEmail } from "./helpers";

// #290: a sign-in code pasted from a mail or a text message ("123 456", a leading space) or typed with a Chinese input
// method's full-width digits is cleaned to its six digits, not cut to five.
for (const [name, shape] of [
  ["spaced, with a leading space", (code: string) => ` ${code.slice(0, 3)} ${code.slice(3)}`],
  ["in full-width digits", (code: string) => code.replace(/\d/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xfee0))],
] as const)
  test(`a sign-in code ${name} still signs in`, async ({ page }) => {
    await page.goto("/login?next=%2Fme");
    await page.getByLabel("邮箱", { exact: true }).fill(freshEmail("code.paste"));
    await page.getByRole("button", { name: "获取验证码" }).click();
    const shown = page.getByTestId("dev-sign-in-code");
    await expect(shown).toHaveText(/^\d{6}$/);
    const code = (await shown.textContent())!.trim();
    const box = page.getByLabel("验证码");
    await box.fill(shape(code));
    await expect(box).toHaveValue(code);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL("/me");
  });
