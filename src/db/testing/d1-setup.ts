// Setup of the D1 tests (vitest.d1.config.mts, ADR 0031): each test file gets its own local D1 database in Miniflare,
// emptied and migrated the way wrangler migrates (src/db/d1-migrations.ts) on first use and after each reset.
import { convertV4MiniflareOptions, Miniflare, type V4MiniflareOptions } from "miniflare";
import { afterAll } from "vitest";
import { setD1ForTests, type D1Binding } from "@/db/client";
import { migrationFiles } from "@/db/d1-migrations";
import { childFirstTables, sqlIdentifier } from "@/db/testing/drop-order";

const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: true,
    script: "export default { fetch: () => new Response('') };",
    d1Databases: { DB: "zhaogong-test" },
  } satisfies V4MiniflareOptions),
);
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
  if (results.length) {
    const references = await Promise.all(
      results.map(async (row: Record<string, unknown>) => {
        const name = String(row.name);
        const keys = await d1.prepare(`PRAGMA foreign_key_list(${sqlIdentifier(name)})`).all();
        return { name, parents: keys.results.map((key: Record<string, unknown>) => String(key.table)) };
      }),
    );
    // Deferral alone does not stop CASCADE from accessing a parent which sqlite_master listed earlier.
    const order = childFirstTables(references);
    await d1.batch([
      d1.prepare("PRAGMA defer_foreign_keys = on"),
      ...order.map((name) => d1.prepare(`DROP TABLE ${sqlIdentifier(name)}`)),
    ]);
  }
  for (const file of migrationFiles()) await d1.batch(file.statements.map((statement) => d1.prepare(statement)));
}

setD1ForTests(d1, freshen);

afterAll(async () => {
  setD1ForTests(undefined);
  await mf.dispose();
});
