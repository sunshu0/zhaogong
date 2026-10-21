// #343: the engineering docs fall behind the code without anyone noticing — #336's views-actions.ts reached main
// without a line in docs/api.md or docs/architecture.md, and two tables were missing from the table list. These
// checks name what a change has to add to the docs, in seconds: each Server Function file, each ADR and each table;
// #355: each environment variable the code reads, and each page.
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
  const tables = new Set();
  // Rebuild migrations rename a temporary table back to the original name; those are not extra product tables.
  for (const match of sql.matchAll(
    /CREATE TABLE `([a-z_]+)`|DROP TABLE `([a-z_]+)`|ALTER TABLE `([a-z_]+)` RENAME TO `([a-z_]+)`/g,
  )) {
    if (match[1]) tables.add(match[1]);
    if (match[2]) tables.delete(match[2]);
    if (match[3]) {
      tables.delete(match[3]);
      tables.add(match[4]);
    }
  }
  return [...tables].sort();
}

/**
 * The environment variables and Worker bindings the code reads (process.env.X, env.X, a Cloudflare context's
 * env?.X), NODE_ENV aside: Next and Node set it.
 */
function environmentVariables() {
  const sources = [...files("src"), "next.config.ts"].filter(
    (path) => /\.(ts|tsx|mjs)$/.test(path) && !/\.test\./.test(path),
  );
  const names = sources.flatMap((path) =>
    [...read(path).matchAll(/(?:process\.env|\benv\??)\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]),
  );
  return [...new Set(names)].filter((name) => name !== "NODE_ENV").sort();
}

/** The site's pages, as addresses: src/app/[lang]/jobs/[id]/page.tsx is /jobs/[id]; the catch-all 404 aside. */
function pageRoutes() {
  return files("src/app")
    .map((path) => path.replaceAll("\\", "/"))
    .filter((path) => path.endsWith("/page.tsx") && !path.includes("[...missing]"))
    .map(
      (path) =>
        path
          .replace(/^src\/app/, "")
          .replace("/[lang]", "")
          .replace(/\/page\.tsx$/, "") || "/",
    )
    .sort();
}

describe("docs follow the code", () => {
  it("finds the Server Function files and the tables at all", () => {
    expect(serverFunctionFiles()).toContain("src/app/[lang]/login/actions.ts");
    expect(migratedTables()).toContain("jobs");
    expect(migratedTables()).toContain("job_applications");
    expect(migratedTables()).not.toContain("__new_job_applications");
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

  it("lists every environment variable the code reads in the deployment checklist (#355)", () => {
    expect(environmentVariables()).toContain("DATABASE_URL");
    const checklist = read("docs/cloudflare-deployment.md");
    expect(environmentVariables().filter((name) => !checklist.includes(`\`${name}\``))).toEqual([]);
  });

  it("lists every page in docs/api.md's 页面路由 (#355)", () => {
    expect(pageRoutes()).toContain("/jobs/[id]");
    const routes = read("docs/api.md").split("## 页面路由")[1] ?? "";
    expect(pageRoutes().filter((route) => !routes.includes(`\`${route}\``))).toEqual([]);
  });

  it("names every table the migrations leave in docs/architecture.md", () => {
    const architecture = read("docs/architecture.md");
    expect(migratedTables().filter((name) => !architecture.includes(`\`${name}\``))).toEqual([]);
  });
});
