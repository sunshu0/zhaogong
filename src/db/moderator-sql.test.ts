import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { d1Binding, freshenD1ForTests, resetDbForTests } from "@/db/client";
import { moderatorBootstrapSql } from "@/db/moderator-sql";

const clients: Client[] = [];
async function freshDatabase() {
  const client = createClient({ url: "file::memory:" });
  clients.push(client);
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  return client;
}
afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});

describe("first moderator SQL", () => {
  it("creates a normalized account and grants permission without creating a session", async () => {
    const db = await freshDatabase();
    const now = new Date("2026-10-22T00:00:00Z");
    await db.batch(moderatorBootstrapSql("  Owner@Example.COM  ", now).statements, "write");
    expect((await db.execute("SELECT email, created_at, last_role FROM accounts")).rows).toEqual([
      { email: "owner@example.com", created_at: now.toISOString(), last_role: "seeker" },
    ]);
    expect((await db.execute("SELECT * FROM moderators")).rows).toEqual([
      { email: "owner@example.com", granted_at: now.toISOString(), granted_by: null },
    ]);
    expect((await db.execute("SELECT * FROM sessions")).rows).toEqual([]);
    expect((await db.execute("SELECT * FROM sign_in_codes")).rows).toEqual([]);
  });

  it("preserves an existing account and the original grant on repeated imports", async () => {
    const db = await freshDatabase();
    await db.execute(
      "INSERT INTO accounts (email, created_at, last_role, lang) VALUES ('owner@example.com', '2026-01-01', 'employer', 'en')",
    );
    const artifact = moderatorBootstrapSql("owner@example.com", new Date("2026-10-22T00:00:00Z"));
    await db.batch(artifact.statements, "write");
    const account = (await db.execute("SELECT * FROM accounts")).rows;
    const grant = (await db.execute("SELECT * FROM moderators")).rows;
    await db.batch(moderatorBootstrapSql("OWNER@example.com", new Date("2026-10-23T00:00:00Z")).statements, "write");
    expect((await db.execute("SELECT * FROM accounts")).rows).toEqual(account);
    expect(account[0]).toMatchObject({ created_at: "2026-01-01", last_role: "employer", lang: "en" });
    expect((await db.execute("SELECT * FROM moderators")).rows).toEqual(grant);
    // ADR 0043: one record of the grant, as from the command line, however often the file is imported.
    expect((await db.execute("SELECT at, action, email, by FROM moderator_changes")).rows).toEqual([
      { at: "2026-10-22T00:00:00.000Z", action: "grant", email: "owner@example.com", by: null },
    ]);
  });

  it("quotes apostrophes and SQL-shaped email text as a single value", async () => {
    const db = await freshDatabase();
    const email = "o'neil');DELETE/**/FROM/**/accounts;--@example.com";
    await db.batch(moderatorBootstrapSql(email).statements, "write");
    expect((await db.execute("SELECT email FROM accounts")).rows).toEqual([{ email: email.toLowerCase() }]);
    expect((await db.execute("SELECT email FROM moderators")).rows).toEqual([{ email: email.toLowerCase() }]);
  });

  it.each(["", "no-domain", "a@b", "two users@example.com", "nul\u0000@example.com", "del\u007f@example.com"])(
    "refuses invalid email %j",
    (email) => expect(() => moderatorBootstrapSql(email)).toThrow(/valid moderator email/),
  );

  it.skipIf(!d1Binding())("grants once on local D1 without resetting the original permission timestamp", async () => {
    resetDbForTests();
    await freshenD1ForTests();
    const d1 = d1Binding()!;
    const now = new Date("2026-10-22T00:00:00Z");
    for (const at of [now, new Date("2026-10-23T00:00:00Z")]) {
      await d1.batch(
        moderatorBootstrapSql("owner@example.com", at).statements.map((statement) => d1.prepare(statement)),
      );
    }
    expect(
      await d1.prepare("SELECT granted_at FROM moderators WHERE email = 'owner@example.com'").first("granted_at"),
    ).toBe(now.toISOString());
    expect((await d1.prepare("PRAGMA foreign_key_check").all()).results).toEqual([]);
  });
});
