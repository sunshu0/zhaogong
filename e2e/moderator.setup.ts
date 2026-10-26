// Runs once before the specs (project "moderator-session" in playwright.config.ts): signs in the demo moderator
// (#50, DEMO_MODERATOR in src/db/seed.ts) and the demo admin (ADR 0043), and keeps the sessions for moderatorPage()
// and adminPage(). Both land on 审核后台: a staff account has no other page.
import { test as setup } from "@playwright/test";
import { signIn } from "./helpers";
import { ADMIN_EMAIL, ADMIN_STATE, MODERATOR_EMAIL, MODERATOR_STATE } from "./employer/helpers";

setup("sign in the demo moderator", async ({ page }) => {
  await signIn(page, "/admin", MODERATOR_EMAIL);
  await page.context().storageState({ path: MODERATOR_STATE });
});

setup("sign in the demo admin", async ({ page }) => {
  await signIn(page, "/admin", ADMIN_EMAIL);
  await page.context().storageState({ path: ADMIN_STATE });
});
