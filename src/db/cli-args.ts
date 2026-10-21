// Validate maintenance commands before opening or migrating any database.
import { parseArgs } from "node:util";

const COMMANDS = ["migrate", "seed", "admin:grant", "admin:revoke", "import:external"] as const;
export type DatabaseCommand = (typeof COMMANDS)[number];

export interface DatabaseArguments {
  command: DatabaseCommand;
  args: string[];
  localD1: boolean;
  persistTo: string;
}

export const DATABASE_USAGE =
  "Usage: tsx src/db/cli.ts migrate | seed | admin:grant <email> | admin:revoke <email> | import:external [--dry-run] [company ids] [--d1-local] [--persist-to <directory>]";

export function parseDatabaseArguments(argv: string[]): DatabaseArguments {
  const [command, ...args] = argv;
  if (!COMMANDS.includes(command as DatabaseCommand)) throw new Error(DATABASE_USAGE);
  const { values, positionals, tokens } = parseArgs({
    args,
    allowPositionals: true,
    strict: true,
    tokens: true,
    options: {
      "d1-local": { type: "boolean" },
      "d1-remote": { type: "boolean" },
      "persist-to": { type: "string" },
      "dry-run": { type: "boolean" },
    },
  });
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.kind !== "option") continue;
    if (seen.has(token.name)) throw new Error(`Repeated option: --${token.name}`);
    seen.add(token.name);
  }
  if (values["d1-remote"]) throw new Error("Remote D1 is not supported by this local setup command.");
  if (values["persist-to"] !== undefined) {
    if (!values["d1-local"]) throw new Error("--persist-to requires --d1-local.");
    if (!values["persist-to"].trim() || values["persist-to"].startsWith("--")) {
      throw new Error("--persist-to needs a directory.");
    }
  }
  if (values["dry-run"] && command !== "import:external") {
    throw new Error("--dry-run is only supported by import:external.");
  }
  const moderator = command === "admin:grant" || command === "admin:revoke";
  if (moderator && positionals.length !== 1) throw new Error(`${DATABASE_USAGE}\nGive one account email.`);
  if (!moderator && command !== "import:external" && positionals.length) {
    throw new Error(`${command} does not accept positional arguments.`);
  }
  return {
    command: command as DatabaseCommand,
    args: values["dry-run"] ? ["--dry-run", ...positionals] : positionals,
    localD1: values["d1-local"] ?? false,
    persistTo: values["persist-to"] ?? ".wrangler/state",
  };
}
