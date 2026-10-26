// Which accounts see the demo's made-up people and events (#110): the demo chats (chat-demo.ts) and the demo
// notifications (initialNotifications). Everyone else starts empty, so a real account never meets 林晓 or 北岸早茶酒家.
// Browser and server both use it.

/** The demo job seeker: saved jobs and a job alert already in use (#88). */
export const DEMO_SEEKER = "seeker@example.com";
/** The demo employer: sign in and pick 川味小馆. */
export const DEMO_EMPLOYER = "boss@example.com";
/** The demo moderator (#50). */
export const DEMO_MODERATOR = "moderator@example.com";
/**
 * The demo admin (ADR 0043): an admin through ZHAOGONG_ADMIN_EMAILS, which .env.development and the browser tests set
 * to this address. Not one of the FIXED demo people below: an admin's account meets nobody made up.
 */
export const DEMO_ADMIN = "admin@example.com";

const FIXED = new Set([DEMO_SEEKER, DEMO_EMPLOYER, DEMO_MODERATOR]);

/**
 * The fixed demo addresses, and any example.com address starting with `demo.`: the browser tests give each test its
 * own demo account, so tests running side by side do not share one demo's records. example.com receives no mail
 * (RFC 2606), so nobody can sign in with these on a real site.
 */
export function isDemoAccount(email: string | null | undefined): boolean {
  if (!email) return false;
  const address = email.trim().toLowerCase();
  return FIXED.has(address) || /^demo\.[^@]*@example\.com$/.test(address);
}
