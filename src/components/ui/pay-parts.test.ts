import { describe, expect, it } from "vitest";
import { payParts } from "./pay-parts";

describe("payParts", () => {
  it("splits a range into the figure and the unit", () => {
    expect(payParts({ min: 25, max: 27 }, "NZ")).toEqual({ amount: "$25–27", unit: "/小时" });
  });

  it("keeps a single rate and cents", () => {
    expect(payParts({ min: 24 }, "NZ")).toEqual({ amount: "$24", unit: "/小时" });
    expect(payParts({ min: 23.5, max: 23.5 }, "NZ")).toEqual({ amount: "$23.50", unit: "/小时" });
  });
});
