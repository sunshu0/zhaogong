import { describe, expect, it, vi } from "vitest";
import { busyProps, holdClick } from "@/components/ui/busy";

describe("busyProps (#202)", () => {
  it("marks a busy button aria-disabled and aria-busy and holds its presses, without disabling it", () => {
    const props = busyProps(true);
    expect(props).toEqual({ "aria-disabled": true, "aria-busy": true, onClickCapture: holdClick });
    expect(props).not.toHaveProperty("disabled");
  });

  it("adds nothing when the button is not busy", () => {
    expect(busyProps(false)).toEqual({});
  });

  it("holds a press: no default action (a form is not sent) and no onClick further along", () => {
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    holdClick(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });
});
