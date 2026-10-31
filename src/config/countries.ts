// Per-country settings. Adding a market means adding an entry here, not changing pages.
import type { CountryCode, VisaAccepted } from "@/lib/types";

export interface Region {
  id: string;
  nameZh: string;
  nameEn: string;
  /** Parent area, e.g. Auckland for its suburbs. */
  area: string;
}

export interface CountryConfig {
  code: CountryCode;
  enabled: boolean;
  nameZh: string;
  /** The English interface's name for the country (Round 20). */
  nameEn: string;
  currency: "NZD" | "AUD";
  currencySymbol: string;
  /**
   * Adult minimum hourly wage and the date it took effect; `startingOut` is the lower rate some young workers and
   * trainees may be paid (New Zealand's starting-out and training wages, the same number), from the same date.
   * countries.test.ts fails a year after `effectiveFrom`, when the rates are due to change.
   */
  minimumWage: { hourly: number; startingOut: number; effectiveFrom: string; source: string };
  businessNumberLabel: string; // NZBN / ABN
  visaTypes: VisaAccepted[];
  regions: Region[];
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  NZ: {
    code: "NZ",
    enabled: true,
    nameZh: "新西兰",
    nameEn: "New Zealand",
    currency: "NZD",
    currencySymbol: "$",
    minimumWage: {
      hourly: 23.95,
      // Checked on employment.govt.nz/pay-and-hours/pay-and-wages/minimum-wage/minimum-wage-rates-and-types, 2026-10-25.
      startingOut: 19.16,
      effectiveFrom: "2026-04-01",
      source: "https://www.employment.govt.nz/news-and-updates/minimum-wage-is-increasing-on-1-april-2026",
    },
    businessNumberLabel: "NZBN",
    visaTypes: ["citizen_resident", "open_work", "aewv", "student", "working_holiday"],
    regions: [
      { id: "akl-cbd", nameZh: "市中心", nameEn: "Auckland CBD", area: "Auckland" },
      { id: "akl-mt-eden", nameZh: "Mt Eden / Dominion Rd", nameEn: "Mt Eden / Dominion Rd", area: "Auckland" },
      { id: "akl-newmarket", nameZh: "Newmarket", nameEn: "Newmarket", area: "Auckland" },
      { id: "akl-mt-albert", nameZh: "Mt Albert / Sandringham", nameEn: "Mt Albert / Sandringham", area: "Auckland" },
      { id: "akl-northcote", nameZh: "Northcote", nameEn: "Northcote", area: "Auckland" },
      { id: "akl-takapuna", nameZh: "Takapuna", nameEn: "Takapuna", area: "Auckland" },
      { id: "akl-albany", nameZh: "Albany", nameEn: "Albany", area: "Auckland" },
      { id: "akl-glenfield", nameZh: "Glenfield", nameEn: "Glenfield", area: "Auckland" },
      { id: "akl-henderson", nameZh: "Henderson / 西区", nameEn: "Henderson / West", area: "Auckland" },
      {
        id: "akl-mt-wellington",
        nameZh: "Mt Wellington / Sylvia Park",
        nameEn: "Mt Wellington / Sylvia Park",
        area: "Auckland",
      },
      { id: "akl-botany", nameZh: "Botany / East Tamaki", nameEn: "Botany / East Tamaki", area: "Auckland" },
      { id: "akl-howick", nameZh: "Howick / Pakuranga", nameEn: "Howick / Pakuranga", area: "Auckland" },
      { id: "akl-manukau", nameZh: "Manukau / 南区", nameEn: "Manukau / South", area: "Auckland" },
    ],
  },
  AU: {
    code: "AU",
    enabled: false,
    nameZh: "澳大利亚",
    nameEn: "Australia",
    currency: "AUD",
    currencySymbol: "$",
    // Placeholder until the AU market opens; check Fair Work before enabling.
    minimumWage: { hourly: 0, startingOut: 0, effectiveFrom: "", source: "" },
    businessNumberLabel: "ABN",
    visaTypes: ["citizen_resident", "open_work", "student", "working_holiday"],
    regions: [],
  },
};

export const DEFAULT_COUNTRY: CountryCode = "NZ";

/** The areas' Chinese names, as people write them (the regions above name suburbs only). */
export const AREA_ZH: Record<string, string> = { Auckland: "奥克兰" };

export function regionById(country: CountryCode, id: string): Region | undefined {
  return COUNTRIES[country].regions.find((r) => r.id === id);
}
