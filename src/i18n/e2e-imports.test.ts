// #322: the browser tests cannot load src/i18n/english.ts — Playwright's loader does not take its top-level await —
// so an e2e file that reaches it through its imports stops the whole suite while it loads, before any test runs
// (gate20 lost a GPU turn so: entry-walk and interview reached it through interviews.ts). This walks every e2e file's
// static imports into src/ and fails with the whole chain, in seconds and without a browser. Type-only imports
// load nothing and are skipped. The way out is a module without the dictionary (as auckland-time.ts, #240).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const ENGLISH = resolve(ROOT, "src/i18n/english.ts");
// `import … from "x"` and `export … from "x"`, not `import type` / `export type`; and `import "x"`.
const FROM = /(?:^|\n)\s*(?:import|export)\s+(?!type\s)[^;]*?\sfrom\s*["']([^"']+)["']/g;
const BARE = /(?:^|\n)\s*import\s*["']([^"']+)["']/g;

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

/** The file an import names, or null for a package (node_modules is not the browser tests' problem). */
function resolveImport(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? resolve(ROOT, "src", specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(from), specifier)
      : null;
  if (!base) return null;
  for (const file of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")])
    if (existsSync(file) && statSync(file).isFile()) return file;
  return null;
}

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const specifiers = [...source.matchAll(FROM), ...source.matchAll(BARE)].map((m) => m[1]);
  return specifiers.map((s) => resolveImport(file, s)).filter((f): f is string => f !== null);
}

/** The chain of imports from `start` to english.ts, or null when there is none. */
export function chainToEnglish(start: string): string[] | null {
  const cameFrom = new Map<string, string | null>([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const file = queue.shift()!;
    if (file === ENGLISH) {
      const chain: string[] = [];
      for (let at: string | null = file; at; at = cameFrom.get(at) ?? null) chain.unshift(relative(ROOT, at));
      return chain;
    }
    for (const next of importsOf(file))
      if (!cameFrom.has(next)) {
        cameFrom.set(next, file);
        queue.push(next);
      }
  }
  return null;
}

describe("the browser tests' imports (#322)", () => {
  it("find the way to english.ts where there is one, so a pass means something", () => {
    expect(chainToEnglish(resolve(ROOT, "src/components/seeker/interviews.ts"))).toContain(
      join("src", "i18n", "english.ts"),
    );
  });

  const specs = tsFiles(resolve(ROOT, "e2e"));
  it("cover the e2e folder", () => {
    expect(specs.length).toBeGreaterThan(40);
  });

  for (const spec of specs)
    it(`${relative(ROOT, spec)} does not reach src/i18n/english.ts`, () => {
      const chain = chainToEnglish(spec);
      expect(chain, chain ? `loads english.ts: ${chain.join(" → ")}` : "").toBeNull();
    });
});
