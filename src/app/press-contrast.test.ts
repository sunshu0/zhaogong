import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A pressed or hovered thing keeps its text readable (WCAG AA 4.5:1, 10-23): the brand button darkens to
// --brand-strong instead of fading, a pressed list row takes --press-soft, and "reduce motion" draws a ring instead of
// dimming. Read from globals.css, so a token change that drops below 4.5:1 fails here.
const css = readFileSync("src/app/globals.css", "utf8");
const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
const token = (name: string) => {
  const value = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(root)?.[1];
  if (!value) throw new Error(`--${name} not found in :root`);
  return value;
};

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("pressed and hovered things keep their text at 4.5:1", () => {
  it("white on the brand button at rest, hovered and pressed", () => {
    expect(contrast("#ffffff", token("brand"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", token("brand-strong"))).toBeGreaterThanOrEqual(4.5);
  });

  it("white on the main (accent) button at rest, hovered and pressed (#375)", () => {
    expect(contrast("#ffffff", token("accent"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", token("accent-strong"))).toBeGreaterThanOrEqual(4.5);
  });

  it("white on the danger button at rest, hovered and pressed (UI audit 1)", () => {
    expect(contrast("#ffffff", token("danger"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", token("danger-strong"))).toBeGreaterThanOrEqual(4.5);
  });

  it("pay and every text colour on the page, the cards and the soft fills (#375, visual A)", () => {
    for (const text of ["foreground", "muted", "brand", "accent", "danger", "warn", "ok"])
      for (const ground of ["surface", "background"])
        expect(contrast(token(text), token(ground)), `${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
    for (const [text, ground] of [
      ["brand", "brand-soft"],
      ["accent", "accent-soft"],
      ["danger", "danger-soft"],
      ["warn", "warn-soft"],
      ["ok", "ok-soft"],
      ["muted", "neutral-soft"],
    ])
      expect(contrast(token(text), token(ground)), `${text} on ${ground}`).toBeGreaterThanOrEqual(4.5);
  });

  it("every text colour on a pressed list row", () => {
    for (const text of ["foreground", "muted", "brand", "accent", "danger", "warn", "ok"])
      expect(contrast(token(text), token("press-soft")), text).toBeGreaterThanOrEqual(4.5);
  });

  it("no hover or press fades a button: opacity is not the answer", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced.slice(0, reduced.indexOf("\n}\n"))).not.toMatch(/opacity/);
    for (const file of [
      "src/components/ui/Button.tsx",
      "src/app/[lang]/page.tsx",
      "src/components/seeker/AccountMenu.tsx",
      "src/components/seeker/ChatThread.tsx",
    ])
      expect(readFileSync(file, "utf8"), file).not.toMatch(/bg-brand[^"`]*(hover|active):opacity/);
  });
});
