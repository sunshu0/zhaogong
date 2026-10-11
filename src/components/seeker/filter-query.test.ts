import { describe, expect, it } from "vitest";
import { filterChips, filterToQuery, isFiltered, parseFilter, toParams } from "@/components/seeker/filter-query";
import { listJobs } from "@/lib/data";
import type { JobFilter } from "@/lib/types";

const parse = (query: string) => parseFilter(toParams(new URLSearchParams(query)), "NZ");

describe("parseFilter", () => {
  it("reads every filter from the query", () => {
    expect(
      parse("region=akl-cbd&industry=hospitality&type=part_time&minPay=25&visa=student&meals=1&housing=1&q=奶茶"),
    ).toEqual({
      country: "NZ",
      regionIds: ["akl-cbd"],
      industries: ["hospitality"],
      employmentTypes: ["part_time"],
      minPay: 25,
      visa: "student",
      mealsIncluded: true,
      accommodationIncluded: true,
      query: "奶茶",
    });
  });

  it("accepts lists both comma-separated and as repeated keys, in config order without duplicates", () => {
    const expected = ["akl-cbd", "akl-newmarket", "akl-albany"];
    expect(parse("region=akl-albany,akl-cbd&region=akl-newmarket").regionIds).toEqual(expected);
    expect(parse("region=akl-albany&region=akl-newmarket&region=akl-cbd&region=akl-cbd").regionIds).toEqual(expected);
    expect(parse("industry=retail,hospitality").industries).toEqual(["hospitality", "retail"]);
  });

  it("drops values it does not know", () => {
    expect(parse("region=akl-nowhere&industry=mining&type=gig&visa=tourist")).toEqual({ country: "NZ" });
  });

  it("ignores a minimum pay that is not a positive number", () => {
    for (const v of ["", "abc", "-5", "0", "Infinity"]) expect(parse(`minPay=${v}`).minPay).toBeUndefined();
    expect(parse("minPay=27.5").minPay).toBe(27.5);
  });

  it("only treats 1 or true as on for meals and accommodation", () => {
    expect(parse("meals=0&housing=no")).toEqual({ country: "NZ" });
    expect(parse("meals=true").mealsIncluded).toBe(true);
  });

  it("trims the keyword, ignores an empty one and caps its length", () => {
    expect(parse("q=%20%20").query).toBeUndefined();
    expect(parse("q=%20dim%20sum%20").query).toBe("dim sum");
    expect(parse(`q=${"长".repeat(80)}`).query).toHaveLength(50);
  });

  it("ignores empty fields from a submitted form", () => {
    expect(parse("q=&minPay=&visa=")).toEqual({ country: "NZ" });
  });
});

describe("filterToQuery", () => {
  it("is empty when nothing is filtered", () => {
    expect(filterToQuery({ country: "NZ" })).toBe("");
  });

  it("writes a short query with lists joined by commas", () => {
    expect(
      filterToQuery({
        country: "NZ",
        regionIds: ["akl-cbd", "akl-newmarket"],
        industries: ["hospitality"],
        minPay: 25,
        mealsIncluded: true,
        query: "点心 师傅",
      }),
    ).toBe("region=akl-cbd,akl-newmarket&industry=hospitality&minPay=25&meals=1&q=%E7%82%B9%E5%BF%83%20%E5%B8%88%E5%82%85");
  });

  it("round-trips through parseFilter", () => {
    const filter: JobFilter = {
      country: "NZ",
      regionIds: ["akl-mt-eden", "akl-botany"],
      industries: ["retail", "office"],
      employmentTypes: ["full_time", "casual"],
      minPay: 24.5,
      visa: "working_holiday",
      mealsIncluded: true,
      accommodationIncluded: true,
      query: "a&b=c,d",
    };
    expect(parse(filterToQuery(filter))).toEqual(filter);
  });
});

describe("filterChips", () => {
  it("names each active filter and links to the list without it", () => {
    const chips = filterChips(parse("region=akl-cbd,akl-albany&minPay=25&visa=student&meals=1&q=奶茶"));
    expect(chips.map((c) => c.label)).toEqual(["市中心", "Albany", "时薪 $25 起", "签证：学签", "包餐", "“奶茶”"]);
    expect(chips[0].query).toBe("region=akl-albany&minPay=25&visa=student&meals=1&q=%E5%A5%B6%E8%8C%B6");
    expect(chips[2].query).toBe("region=akl-cbd,akl-albany&visa=student&meals=1&q=%E5%A5%B6%E8%8C%B6");
  });

  it("is empty for an unfiltered list", () => {
    expect(filterChips({ country: "NZ" })).toEqual([]);
    expect(isFiltered({ country: "NZ" })).toBe(false);
    expect(isFiltered(parse("meals=1"))).toBe(true);
  });
});

describe("toParams", () => {
  it("groups repeated form fields", () => {
    const form = new FormData();
    form.append("region", "akl-cbd");
    form.append("region", "akl-albany");
    form.append("q", "厨师");
    expect(toParams(form)).toEqual({ region: ["akl-cbd", "akl-albany"], q: "厨师" });
  });
});

describe("with listJobs", () => {
  it("finds the jobs a shared link describes", async () => {
    const jobs = await listJobs(parse("industry=hospitality&visa=student&minPay=25"));
    expect(jobs.map((j) => j.id)).toEqual(["j1"]);
  });
});
