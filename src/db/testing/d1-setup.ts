// Setup of the D1 tests (vitest.d1.config.mts, ADR 0031): each test file gets its own local D1 database in Miniflare,
// emptied and migrated the way wrangler migrates (src/db/d1-migrations.ts) on first use and after each reset.
import { Miniflare } from "miniflare";
import { afterAll } from "vitest";
import { useD1ForTests, type D1Binding } from "@/db/client";
import { migrationFiles } from "@/db/d1-migrations";

const mf = new Miniflare({
  modules: true,
  script: "export default { fetch: () => new Response('') };",
  d1Databases: { DB: "zhaogong-test" },
});
const d1 = (await mf.getD1Database("DB")) as unknown as D1Binding & {
  prepare(sql: string): { all(): Promise<{ results: Record<string, unknown>[] }> };
  batch(statements: unknown[]): Promise<unknown>;
};

async function freshen(): Promise<void> {
  const { results } = await d1
    .prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '_cf_%'",
    )
    .all();
  if (results.length)
    await d1.batch([
      d1.prepare("PRAGMA defer_foreign_keys = on"),
      ...results.map((row) => d1.prepare(`DROP TABLE "${String(row.name)}"`)),
    ]);
  for (const file of migrationFiles()) await d1.batch(file.statements.map((statement) => d1.prepare(statement)));
}

useD1ForTests(d1, freshen);

afterAll(async () => {
  useD1ForTests(undefined);
  await mf.dispose();
});
