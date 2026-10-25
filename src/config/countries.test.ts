import { describe, expect, it } from "vitest";
import { COUNTRIES } from "@/config/countries";

const YEAR = 365 * 24 * 3600_000;

// The minimum wage changes every 1 April in New Zealand. This fails a year after the rates took effect, on purpose:
// a gate that is about something else stops until someone checks the new rates (ADR 0041).
describe("the minimum wage in the country settings", () => {
  it("was set less than a year ago", () => {
    const wage = COUNTRIES.NZ.minimumWage;
    const age = Date.now() - Date.parse(`${wage.effectiveFrom}T00:00:00+13:00`);
    expect(
      age < YEAR,
      `去 employment.govt.nz 核对新费率，改 src/config/countries.ts 的 minimumWage（hourly、startingOut）和 effectiveFrom：现在写的是 ${wage.effectiveFrom} 起`,
    ).toBe(true);
    expect(wage.startingOut).toBeLessThan(wage.hourly);
  });
});
