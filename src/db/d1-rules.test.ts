import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { d1Binding, setD1ForTests, type D1Binding } from "@/db/client";
import { checkD1Statement, d1Rules } from "@/db/d1-rules";

describe("libSQL under D1's rules (ADR 0031)", () => {
  const db = d1Rules(createClient({ url: "file::memory:" }));

  it("refuses more than 100 parameters in one statement, in execute and in batch", async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => i);
    const sqlFor = (n: number) => `select ${Array.from({ length: n }, () => "?").join(", ")}`;
    await expect(db.execute({ sql: sqlFor(100), args: hundred })).resolves.toBeDefined();
    await expect(db.execute({ sql: sqlFor(101), args: [...hundred, 100] })).rejects.toThrow(/at most 100/);
    await expect(db.batch([{ sql: sqlFor(101), args: [...hundred, 100] }], "write")).rejects.toThrow(/at most 100/);
  });

  it("refuses transaction statements: on D1 a batch is the transaction", () => {
    for (const statement of ["BEGIN", "  begin deferred", "COMMIT", "ROLLBACK", "SAVEPOINT a", "release a"])
      expect(() => checkD1Statement(statement), statement).toThrow(/no interactive transactions/);
    expect(() => checkD1Statement("CREATE TRIGGER t BEFORE INSERT ON x BEGIN SELECT 1; END")).not.toThrow();
  });

  it("also refuses the client's interactive transaction API", async () => {
    await expect(Reflect.get(db, "transaction").call(db)).rejects.toThrow(/no interactive transactions/);
  });

  it("finds foreign keys switched on, as D1 always has them", async () => {
    await db.execute("create table parent (id text primary key)");
    await db.execute("create table child (parent text references parent(id))");
    await expect(db.execute("insert into child values ('nobody')")).rejects.toThrow(/FOREIGN KEY/);
  });
});

describe("which database getDb() opens", () => {
  const cloudflare = Symbol.for("__cloudflare-context__");
  const saved = process.env.DATABASE_URL;
  afterEach(() => {
    delete (globalThis as Record<symbol, unknown>)[cloudflare];
    process.env.DATABASE_URL = saved;
    setD1ForTests(undefined);
  });

  it("uses the Worker's DB binding on Cloudflare, unless DATABASE_URL asks for libSQL", () => {
    const binding = { prepare() {} } as unknown as D1Binding;
    delete process.env.DATABASE_URL;
    (globalThis as Record<symbol, unknown>)[cloudflare] = { env: { DB: binding } };
    expect(d1Binding()).toBe(binding);
    process.env.DATABASE_URL = "file::memory:";
    expect(d1Binding()).toBeUndefined();
    delete process.env.DATABASE_URL;
    delete (globalThis as Record<symbol, unknown>)[cloudflare];
    expect(d1Binding()).toBeUndefined();
  });
});
