import { describe, expect, it } from "vitest";
import { isDemoCompany } from "@/lib/external-jobs/demo";

describe("isDemoCompany", () => {
  it("knows the demo's made-up companies from the real ones", () => {
    expect([isDemoCompany("demo-kowhai"), isDemoCompany("demo-tui")]).toEqual([true, true]);
    expect([isDemoCompany("rocket-lab"), isDemoCompany("fisher-paykel-demo")]).toEqual([false, false]);
  });
});
