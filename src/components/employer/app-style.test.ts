import { describe, expect, it } from "vitest";
import { ACTION_BUTTON, APP_CARD, BACK_LINK, BAR_TEXT_ACTION, CHOICE_PILL, noticeClass } from "./app-style";
import { pillTab } from "./Tabs";

const classes = (s: string) => s.split(/\s+/);

// Round 19 rules for the employer pages (docs/design-system.md): cards with 16px corners and a shadow but no border,
// controls with 12px corners (pills round), 44px targets that answer a press.
describe("the employer pages' Round 19 classes", () => {
  it("draw a card with 16px corners and a shadow, no border", () => {
    expect(classes(APP_CARD)).toEqual(expect.arrayContaining(["rounded-card", "shadow-card", "bg-surface"]));
    expect(APP_CARD).not.toMatch(/\bborder\b/);
  });

  it("give every small action, choice and link a 44px target that answers a press", () => {
    for (const c of [ACTION_BUTTON, CHOICE_PILL, BAR_TEXT_ACTION, BACK_LINK]) {
      expect(classes(c)).toEqual(expect.arrayContaining(["pressable", "min-h-11"]));
    }
  });

  it("use the controls' corners for buttons and round ones for pills", () => {
    expect(classes(ACTION_BUTTON)).toContain("rounded-control");
    expect(classes(CHOICE_PILL)).toContain("rounded-full");
    expect(classes(pillTab(true))).toContain("rounded-full");
  });

  it("fill the chosen pill tab in brand colour and leave the others white", () => {
    expect(classes(pillTab(true))).toEqual(expect.arrayContaining(["bg-brand", "text-white"]));
    expect(classes(pillTab(false))).toEqual(expect.arrayContaining(["bg-surface", "text-muted"]));
    expect(classes(pillTab(false))).not.toContain("bg-brand");
  });

  it("colour a notice green when it worked and red when it did not", () => {
    expect(classes(noticeClass(true))).toEqual(expect.arrayContaining(["bg-ok-soft", "text-ok"]));
    expect(classes(noticeClass(false))).toEqual(expect.arrayContaining(["bg-danger-soft", "text-danger"]));
    expect(classes(noticeClass(true))).toContain("rounded-control");
  });
});
