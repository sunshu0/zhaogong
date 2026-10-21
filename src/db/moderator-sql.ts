// Offline preparation for the first production moderator. Import the whole file using Wrangler; generating it
// grants no permission. Existing account identity and an existing moderator grant are preserved.
import { isValidEmail, normalizeEmail } from "@/components/seeker/session";

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function moderatorBootstrapSql(email: string, now = new Date()): { sql: string; statements: string[] } {
  const address = normalizeEmail(email);
  if (!isValidEmail(address) || /[\u0000-\u001f\u007f]/.test(address)) throw new Error("Give a valid moderator email.");
  const at = literal(now.toISOString());
  const account = literal(address);
  const statements = [
    `INSERT INTO "accounts" ("email", "created_at", "last_role") VALUES (${account}, ${at}, 'seeker') ON CONFLICT ("email") DO NOTHING;`,
    `INSERT INTO "moderators" ("email", "granted_at", "granted_by") VALUES (${account}, ${at}, NULL) ON CONFLICT ("email") DO NOTHING;`,
  ];
  return {
    sql: [
      "-- Zhaogong first moderator bootstrap. Apply migrations first and review the target email below.",
      "-- Import this whole file using wrangler d1 execute --file against the intended database.",
      "-- This grants moderator permission; it does not create a session, send a code or enable /admin.",
      ...statements,
      "",
    ].join("\n"),
    statements,
  };
}
