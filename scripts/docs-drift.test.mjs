// #343: the engineering docs fall behind the code without anyone noticing — #336's views-actions.ts reached main
// without a line in docs/api.md or docs/architecture.md, and two tables were missing from the table list. These
// checks name what a change has to add to the docs, in seconds: each Server Function file, each ADR and each table.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (path) => readFileSync(join(ROOT, path), "utf8");

function files(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    return statSync(join(ROOT, path)).isDirectory() ? files(path) : [path];
  });
}

/** Repo-relative paths, with forward slashes, of the modules that start with "use server". */
function serverFunctionFiles() {
  return files("src")
    .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
    .filter((path) => /^\s*(?:\/\/[^\n]*\n\s*)*["']use server["']/.test(read(path)))
    .map((path) => path.replaceAll("\\", "/"))
    .sort();
}

/** The tables the migrations leave: created and not dropped later. */
function migratedTables() {
  const sql = files("drizzle")
    .filter((path) => path.endsWith(".sql"))
    .sort()
    .map(read)
    .join("\n");
  const created = [...sql.matchAll(/CREATE TABLE `([a-z_]+)`/g)].map((m) => m[1]);
  const dropped = new Set([...sql.matchAll(/DROP TABLE `([a-z_]+)`/g)].map((m) => m[1]));
  return [...new Set(created)].filter((name) => !dropped.has(name)).sort();
}

describe("docs follow the code", () => {
  it("finds the Server Function files and the tables at all", () => {
    expect(serverFunctionFiles()).toContain("src/app/[lang]/login/actions.ts");
    expect(migratedTables()).toContain("jobs");
  });

  it("names every Server Function file in docs/api.md and in architecture.md's list", () => {
    const api = read("docs/api.md");
    const architecture = read("docs/architecture.md");
    const missing = serverFunctionFiles().flatMap((path) => [
      ...(api.includes(path) ? [] : [`docs/api.md: ${path}`]),
      ...(architecture.includes(`| \`${path}\` |`) ? [] : [`docs/architecture.md: ${path}`]),
    ]);
    expect(missing).toEqual([]);
  });

  it("lists every ADR in docs/adr/README.md, and links nothing that is not there", () => {
    const index = read("docs/adr/README.md");
    const adrs = files("docs/adr")
      .map((path) => path.replaceAll("\\", "/").split("/").pop())
      .filter((name) => /^\d{4}-.+\.md$/.test(name));
    const linked = [...index.matchAll(/\]\((\d{4}-[^)]+\.md)\)/g)].map((m) => m[1]);
    expect(adrs.filter((name) => !linked.includes(name))).toEqual([]);
    expect(linked.filter((name) => !adrs.includes(name))).toEqual([]);
  });

  it("names every table the migrations leave in docs/architecture.md", () => {
    const architecture = read("docs/architecture.md");
    expect(migratedTables().filter((name) => !architecture.includes(`\`${name}\``))).toEqual([]);
  });
});
