// Runs once before the specs (project "moderator-session" in playwright.config.ts): signs in the demo moderator
// (#50, DEMO_MODERATOR in src/db/seed.ts) and keeps the session for moderatorPage().
import { test as setup } from "@playwright/test";
import { signIn } from "./helpers";
import { MODERATOR_EMAIL, MODERATOR_STATE } from "./employer/helpers";

setup("sign in the demo moderator", async ({ page }) => {
  await signIn(page, "/admin", MODERATOR_EMAIL);
  await page.context().storageState({ path: MODERATOR_STATE });
});
