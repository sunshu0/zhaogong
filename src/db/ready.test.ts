import { describe, expect, it } from "vitest";
import { migratesOnFirstUse } from "@/db/ready";

// #329: a Cloudflare Worker cannot read drizzle/, so only local databases migrate on first use; a remote one is
// migrated with npm run db:migrate before a deploy.
describe("migratesOnFirstUse", () => {
  it("migrates a local file or a memory database on first use", () => {
    expect(migratesOnFirstUse("file:./data/zhaogong.db")).toBe(true);
    expect(migratesOnFirstUse("file::memory:")).toBe(true);
    expect(migratesOnFirstUse("file:/srv/zhaogong.db")).toBe(true);
  });

  it("leaves a remote database to the command line", () => {
    expect(migratesOnFirstUse("libsql://zhaogong-example.aws-ap-southeast-2.turso.io")).toBe(false);
    expect(migratesOnFirstUse("https://zhaogong-example.aws-ap-southeast-2.turso.io")).toBe(false);
    expect(migratesOnFirstUse("wss://zhaogong-example.aws-ap-southeast-2.turso.io")).toBe(false);
  });
});
