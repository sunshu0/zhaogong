// Setup of the D1 tests (vitest.d1.config.mts, ADR 0031): each test file gets its own local D1 database in Miniflare,
// emptied and migrated the way wrangler migrates (src/db/d1-migrations.ts) on first use and after each reset.
import { createServer } from "node:net";
import { convertV4MiniflareOptions, Miniflare, type V4MiniflareOptions } from "miniflare";
import { afterAll } from "vitest";
import { setD1ForTests, type D1Binding } from "@/db/client";
import { migrationFiles } from "@/db/d1-migrations";
import { childFirstTables, sqlIdentifier } from "@/db/testing/drop-order";

/**
 * Where Miniflare listens. Left to the system (port 0), Windows on this machine hands out 1024–15000, which holds
 * 19 ports fetch refuses (6000, 6665–6669, 10080, …), and a file failed now and then with "bad port". 18700–18799 is above
 * every port fetch refuses (the highest is 10080) and the system's range, and clear of the ports Windows reserves
 * (8059–8586) and the other projects use (8130–8149, 864x, 8701–8703, 8770). Each file tries them from its own place
 * and takes the first one free, so runs in two clones at once do not meet.
 */
const PORTS = { first: 18_700, count: 100 };

function isFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

async function startMiniflare(): Promise<Miniflare> {
  // Its own place: from its process id, which differs between the runs of two clones (one file at a time in each).
  const start = process.pid % PORTS.count;
  let lastError: unknown;
  for (let i = 0; i < PORTS.count; i++) {
    const port = PORTS.first + ((start + i) % PORTS.count);
    if (!(await isFree(port))) continue;
    const mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: "export default { fetch: () => new Response('') };",
        d1Databases: { DB: "zhaogong-test" },
        host: "127.0.0.1",
        port,
      } satisfies V4MiniflareOptions),
    );
    try {
      await mf.ready;
      return mf;
    } catch (error) {
      // Taken between the check and workerd's listen: the next one.
      lastError = error;
      await mf.dispose().catch(() => {});
    }
  }
  throw new Error(`no free port in ${PORTS.first}–${PORTS.first + PORTS.count - 1} for Miniflare`, {
    cause: lastError,
  });
}

const mf = await startMiniflare();
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
