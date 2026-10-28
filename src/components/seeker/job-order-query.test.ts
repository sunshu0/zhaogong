import { describe, expect, it } from "vitest";
import { filterChips, filterToQuery, parseFilter, toParams, usedFilterNames } from "./filter-query";
import { jobListQuery, parseJobOrder, withJobOrder } from "./job-order-query";
import { normalizeAlertQuery } from "./job-alerts";

describe("job order is a linkable display choice, separate from hard filters", () => {
  it("accepts exactly one known recommended value; absent, latest, malformed and repeated values use latest", () => {
    expect(parseJobOrder({ sort: "recommended" })).toBe("recommended");
    for (const sort of [
      undefined,
      "latest",
      "newest",
      " recommended ",
      "<script>",
      ["recommended"],
      ["latest", "recommended"],
    ]) {
      expect(parseJobOrder({ sort })).toBe("latest");
    }
    expect(parseJobOrder(toParams(new URLSearchParams("sort=recommended&sort=latest")))).toBe("latest");
  });

  it("preserves canonical search/filter ordering while switching sort or submitting a native GET", () => {
    const params = toParams(new URLSearchParams("sort=recommended&q=厨师&region=akl-cbd&type=part_time"));
    const filter = parseFilter(params, "NZ");
    const canonical = "region=akl-cbd&type=part_time&q=%E5%8E%A8%E5%B8%88";
    expect(jobListQuery(filter, parseJobOrder(params))).toBe(`${canonical}&sort=recommended`);
    expect(jobListQuery(filter, "latest")).toBe(canonical);
    expect(withJobOrder("", "recommended")).toBe("sort=recommended");
    expect(withJobOrder("", "latest")).toBe("");
    const form = new FormData();
    form.set("sort", "recommended");
    form.set("q", "咖啡");
    expect(jobListQuery(parseFilter(toParams(form), "NZ"), parseJobOrder(toParams(form)))).toBe(
      "q=%E5%92%96%E5%95%A1&sort=recommended",
    );
  });

  it("keeps sort through chip removal/clear while leaving alert identity and analytics unchanged", () => {
    const filter = parseFilter({ region: "akl-cbd", type: "casual", sort: "recommended" }, "NZ");
    expect(filterChips(filter)).toHaveLength(2);
    expect(filterChips(filter).map(({ query }) => withJobOrder(query, "recommended"))).toEqual([
      "type=casual&sort=recommended",
      "region=akl-cbd&sort=recommended",
    ]);
    expect(usedFilterNames(filter)).toBe("region,type");
    expect(normalizeAlertQuery(jobListQuery(filter, "recommended"), "NZ")).toBe(filterToQuery(filter));
    expect(normalizeAlertQuery(jobListQuery(filter, "latest"), "NZ")).toBe(filterToQuery(filter));
  });
});
