import { describe, expect, it } from "vitest";
import { fallbackScroll, parsePlace, returnList, type Place } from "./list-place-core";

const place: Place = { list: "/jobs?region=north-shore", href: "/jobs/j3", top: 380, scrollY: 1557 };

describe("parsePlace", () => {
  it("reads a stored place", () => {
    expect(parsePlace(JSON.stringify(place))).toEqual(place);
  });

  it("is null for nothing, bad JSON, or a value that is not a place", () => {
    expect(parsePlace(null)).toBeNull();
    expect(parsePlace("{")).toBeNull();
    expect(parsePlace("3")).toBeNull();
    expect(parsePlace(JSON.stringify({ ...place, top: "380" }))).toBeNull();
    // Only paths of this site.
    expect(parsePlace(JSON.stringify({ ...place, list: "https://example.com/jobs" }))).toBeNull();
    expect(parsePlace(JSON.stringify({ ...place, href: "javascript:alert(1)" }))).toBeNull();
  });
});

describe("returnList", () => {
  it("is the list, query and all, when the page was opened from a list at that path", () => {
    expect(returnList(place, "/jobs/j3", "/jobs")).toBe("/jobs?region=north-shore");
    expect(returnList({ ...place, list: "/jobs" }, "/jobs/j3", "/jobs")).toBe("/jobs");
  });

  it("is null on another page, from another list, or with nothing remembered", () => {
    expect(returnList(place, "/jobs/j4", "/jobs")).toBeNull();
    expect(returnList({ ...place, list: "/me/saved" }, "/jobs/j3", "/jobs")).toBeNull();
    expect(returnList({ ...place, list: "/jobs-archive" }, "/jobs/j3", "/jobs")).toBeNull();
    expect(returnList(null, "/jobs/j3", "/jobs")).toBeNull();
  });
});

describe("fallbackScroll", () => {
  it("keeps the old scroll position inside the page", () => {
    expect(fallbackScroll(1557, 4000, 812)).toBe(1557);
    expect(fallbackScroll(1557, 2000, 812)).toBe(1188);
    expect(fallbackScroll(1557, 600, 812)).toBe(0);
  });
});
