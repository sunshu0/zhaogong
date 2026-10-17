import { describe, expect, it } from "vitest";
import { buttonClass } from "./Button";
import { fieldBorder, inputClass } from "./input-class";

const classes = (s: string) => s.split(/\s+/);

describe("buttonClass", () => {
  it("gives every button the controls' 12px corners, and a pill a round one instead", () => {
    expect(classes(buttonClass("primary"))).toContain("rounded-control");
    expect(classes(buttonClass("secondary", { pill: true }))).toContain("rounded-full");
    expect(classes(buttonClass("secondary", { pill: true }))).not.toContain("rounded-control");
    expect(buttonClass("link")).not.toMatch(/rounded-/);
  });

  it("has a solid red and a red outline for actions that destroy or block", () => {
    expect(classes(buttonClass("danger"))).toEqual(expect.arrayContaining(["bg-danger", "text-white"]));
    expect(classes(buttonClass("danger-secondary"))).toEqual(
      expect.arrayContaining(["border", "border-danger/40", "text-danger"]),
    );
  });
});

describe("inputClass", () => {
  it("is 44px high with 16px text, and a textarea grows instead", () => {
    expect(classes(inputClass())).toEqual(expect.arrayContaining(["h-11", "text-base", "rounded-control"]));
    expect(classes(inputClass({ multiline: true }))).not.toContain("h-11");
  });

  it("colours the border by tone, and only the plain border darkens on hover", () => {
    expect(fieldBorder()).toBe("border-border hover:border-muted");
    expect(classes(inputClass({ tone: "warn" }))).toContain("border-warn");
    expect(classes(inputClass({ tone: "danger" }))).toContain("border-danger");
    expect(inputClass({ tone: "danger" })).not.toContain("border-border");
  });
});
