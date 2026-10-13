import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { PRODUCT_NAME } from "@/i18n/labels";

const root = process.cwd();

function cssToken(name: string): string {
  const css = readFileSync(path.join(root, "src/app/globals.css"), "utf8");
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  if (!match) throw new Error(`token --${name} not found`);
  return match[1].toLowerCase();
}

/** Width and height from a PNG's IHDR chunk. */
function pngSize(publicPath: string): { width: number; height: number } {
  const bytes = readFileSync(path.join(root, "public", publicPath));
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("web app manifest", () => {
  const m = manifest();

  it("names the app and opens on the job list, full screen", () => {
    expect(m.short_name).toBe(PRODUCT_NAME);
    expect(m.name).toContain(PRODUCT_NAME);
    expect(m.lang).toBe("zh-CN");
    expect(m.start_url).toBe("/jobs");
    expect(m.scope).toBe("/");
    expect(m.display).toBe("standalone");
  });

  it("takes its colours from the design tokens", () => {
    expect(m.theme_color).toBe(cssToken("brand"));
    expect(m.background_color).toBe(cssToken("background"));
  });

  it("has the 192 and 512 px icons Android needs, plus a maskable one", () => {
    const icons = m.icons ?? [];
    const has = (sizes: string, purpose: string) =>
      icons.some((i) => i.sizes === sizes && (i.purpose ?? "any") === purpose);
    expect(has("192x192", "any")).toBe(true);
    expect(has("512x512", "any")).toBe(true);
    expect(has("512x512", "maskable")).toBe(true);
  });

  it("points at PNG files that exist and match their declared size", () => {
    for (const icon of manifest().icons ?? []) {
      expect(icon.type).toBe("image/png");
      const [w, h] = String(icon.sizes).split("x").map(Number);
      expect(pngSize(icon.src)).toEqual({ width: w, height: h });
    }
  });

  it("ships the icon iOS uses for 添加到主屏幕", () => {
    expect(pngSize("/icons/apple-touch-icon.png")).toEqual({ width: 180, height: 180 });
  });
});
