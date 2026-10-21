// A libSQL client held to Cloudflare D1's rules (ADR 0031), so code that passes locally also runs on D1:
// - at most 100 bound parameters in one statement;
// - no BEGIN / COMMIT / ROLLBACK / SAVEPOINT in SQL (D1 has no interactive transactions; a batch is the transaction);
// - foreign keys are checked (D1 always checks them; libSQL does by default, and this makes sure it still does).
import type { Client, InArgs, InStatement } from "@libsql/client";

export const D1_MAX_PARAMETERS = 100;

const TRANSACTION_SQL = /^\s*(begin|commit|rollback|end|savepoint|release)\b/i;

function parts(statement: InStatement | [string, InArgs?]): { sql: string; args: InArgs | undefined } {
  if (typeof statement === "string") return { sql: statement, args: undefined };
  if (Array.isArray(statement)) return { sql: statement[0], args: statement[1] };
  return { sql: statement.sql, args: statement.args };
}

/** Throws when D1 would refuse the statement. */
export function checkD1Statement(statement: InStatement | [string, InArgs?]): void {
  const { sql, args } = parts(statement);
  if (TRANSACTION_SQL.test(sql))
    throw new Error(`D1 has no interactive transactions; use db.batch() (ADR 0031). Refused: ${sql.slice(0, 60)}`);
  const count = args ? (Array.isArray(args) ? args.length : Object.keys(args).length) : 0;
  if (count > D1_MAX_PARAMETERS)
    throw new Error(
      `D1 takes at most ${D1_MAX_PARAMETERS} bound parameters in one statement; this one has ${count} (ADR 0031). ` +
        `Split the rows, or pass a list as one JSON parameter (src/db/in-list.ts): ${sql.slice(0, 60)}`,
    );
}

export function d1Rules(client: Client): Client {
  let foreignKeysChecked: Promise<void> | undefined;
  function foreignKeysOn(): Promise<void> {
    foreignKeysChecked ??= client.execute("PRAGMA foreign_keys").then((result) => {
      if (Number(result.rows[0]?.[0]) !== 1)
        throw new Error("libSQL opened the database without foreign key checks; D1 always checks them (ADR 0031).");
    });
    return foreignKeysChecked;
  }
  return new Proxy(client, {
    get(target, prop) {
      if (prop === "transaction") {
        return async () => {
          throw new Error("D1 has no interactive transactions; use db.batch() (ADR 0031).");
        };
      }
      if (prop === "execute") {
        return async (statement: InStatement, args?: InArgs) => {
          checkD1Statement(args === undefined ? statement : [statement as string, args]);
          await foreignKeysOn();
          return args === undefined ? target.execute(statement) : target.execute(statement as string, args);
        };
      }
      if (prop === "batch") {
        return async (statements: Array<InStatement | [string, InArgs?]>, mode?: Parameters<Client["batch"]>[1]) => {
          for (const statement of statements) checkD1Statement(statement);
          await foreignKeysOn();
          return target.batch(statements, mode);
        };
      }
      // The client keeps its state in private fields: read and call everything else on the client itself.
      const value = Reflect.get(target, prop, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
