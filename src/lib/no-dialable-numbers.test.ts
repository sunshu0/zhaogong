import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// New Zealand keeps no phone range for fiction, so any number the site shows could ring a real person (#132).
// Demo numbers are masked instead (021 ••• 0101（演示）). Numbers the tests type are Auckland numbers whose local
// part starts with 0 (09 055 0101), which the numbering plan never gives out (local numbers start with 2–9).
const NZ_PHONE = /(?<!\d)(?:\+?64[\s-]?|0)(?:2\d|[3-9])[\s-]?\d{3}[\s-]?\d{3,4}(?!\d)/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [file] : [];
  });
}

describe("phone numbers in the site's code (#132)", () => {
  it("has none that can be dialled", () => {
    const found = sourceFiles(path.join(process.cwd(), "src")).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(NZ_PHONE)].map((m) => `${path.relative(process.cwd(), file)}: ${m[0]}`),
    );
    expect(found).toEqual([]);
  });

  it("would catch the numbers the demo used to show", () => {
    for (const number of ["021 555 0101", "09 555 0104", "0215550103", "+64 21 555 0101", "021-123-4567"]) {
      expect(number.match(NZ_PHONE)).toEqual([number]);
    }
    expect("021 ••• 0101（演示）".match(NZ_PHONE)).toBeNull();
  });
});
