// Who may sign in while the site is open only to invited accounts (the demo site, decisions 10-30): the addresses in
// SIGN_IN_ALLOWLIST, comma-separated, set where the server runs (a Cloudflare secret). Not set, or empty: everyone
// may, as before. Checked by the server when a code is asked for and again when it is checked (codes.ts). Server only.
import { normalizeEmail } from "@/components/seeker/session";

/** The invited addresses, cleaned (trimmed, lower case); undefined when the list is not set or empty. */
export function signInAllowlist(env: Record<string, string | undefined> = process.env): Set<string> | undefined {
  const list = (env.SIGN_IN_ALLOWLIST ?? "").split(",").map(normalizeEmail).filter(Boolean);
  return list.length ? new Set(list) : undefined;
}

/** Whether this address may get a sign-in code and sign in: always when there is no list. */
export function mayGetSignInCode(email: string, env: Record<string, string | undefined> = process.env): boolean {
  const list = signInAllowlist(env);
  return !list || list.has(normalizeEmail(email));
}
