import { describe, expect, it } from "vitest";
import {
  defaultExternalAlertName,
  externalAlertConditions,
  externalAlertHref,
  externalFilterToQuery,
  normalizeExternalQuery,
  parseSection,
} from "@/lib/external-jobs/alerts";

describe("alerts on the 实习 and 专业职位 sections (#131)", () => {
  it("stores a query in one form: known values only, keys in the form's order", () => {
    expect(normalizeExternalQuery("city=auckland&field=software&junk=1&kind=internship", "internship")).toBe(
      "field=software&kind=internship&city=auckland",
    );
    expect(normalizeExternalQuery("field=software&city=auckland", "internship")).toBe(
      normalizeExternalQuery("city=auckland&field=software", "internship"),
    );
    // A kind of the other section drops out, as it does from a link.
    expect(normalizeExternalQuery("kind=full_time&paid=1", "internship")).toBe("paid=1");
    expect(normalizeExternalQuery(42, "professional")).toBe("");
    expect(externalFilterToQuery({})).toBe("");
  });

  it("names the conditions in words, 原文未说明 included", () => {
    const alert = { section: "professional" as const, query: "field=electrical&kind=unstated&visa=sponsorship&paid=1" };
    expect(externalAlertConditions(alert)).toEqual([
      "电子电气",
      "类型原文未说明",
      "签证：原文写明可以担保签证",
      "写了薪资",
    ]);
    expect(externalAlertConditions({ section: "internship", query: "" })).toEqual([]);
  });

  it("starts the name with the section and keeps it short", () => {
    expect(defaultExternalAlertName({ section: "internship", query: "" })).toBe("全部实习");
    expect(defaultExternalAlertName({ section: "internship", query: "field=software&city=auckland" })).toBe(
      "实习：软件、奥克兰",
    );
    const long = defaultExternalAlertName({
      section: "professional",
      query: "field=electrical&experience=unstated&visa=required&city=nz_other",
    });
    expect(long).toHaveLength(20);
    expect(long.endsWith("…")).toBe(true);
  });

  it("links to the section with the filter", () => {
    expect(externalAlertHref({ section: "internship", query: "" })).toBe("/internships");
    expect(externalAlertHref({ section: "professional", query: "field=software" })).toBe(
      "/professional?field=software",
    );
  });

  it("knows only the two sections", () => {
    expect(parseSection("internship")).toBe("internship");
    expect(parseSection("jobs")).toBeUndefined();
    expect(parseSection(null)).toBeUndefined();
  });
});
