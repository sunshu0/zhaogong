// Who is an admin (ADR 0043): the addresses in ZHAOGONG_ADMIN_EMAILS, comma-separated, set where the server runs (a
// Cloudflare variable, .env.development for `next dev`). Nothing on the site can change it. An admin is a moderator
// too, and the only one who may add or remove moderators. Server only.
import { normalizeEmail } from "@/components/seeker/session";

/** The admins' addresses, cleaned (trimmed, lower case), each once; none when the variable is not set. */
export function adminEmails(env: Record<string, string | undefined> = process.env): string[] {
  const list = (env.ZHAOGONG_ADMIN_EMAILS ?? "").split(",").map(normalizeEmail).filter(Boolean);
  return [...new Set(list)];
}

export function isAdmin(email: string, env: Record<string, string | undefined> = process.env): boolean {
  return adminEmails(env).includes(normalizeEmail(email));
}
