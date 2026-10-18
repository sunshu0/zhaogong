// /admin is a demo without moderator sign-in, so it is off unless ADMIN_ENABLED=1. Local development
// turns it on in .env.development; the deployed Worker (wrangler.jsonc) does not set it.

export function adminEnabled(): boolean {
  return process.env.ADMIN_ENABLED === "1";
}

/** First line of every admin Server Function: refuse outright while the switch is off. */
export function requireAdmin(): void {
  if (!adminEnabled()) throw new Error("/admin is switched off (set ADMIN_ENABLED=1 to turn it on).");
}
