// The English side of candidate-matching.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { candidateMatchingMessages } from "@/i18n/messages/candidate-matching";

export const candidateMatchingEn: Messages<(typeof candidateMatchingMessages)["zh"]> = {
  listJoiner: ", ",

  factors: {
    skills: "Role",
    experience: "Related experience",
    languages: "Languages",
    type: "Job type",
    region: "Area",
    hours: "Hours per week",
    pay: "Expected pay",
  },

  skills: {
    前厅服务: "Front of house",
    点餐: "Taking orders",
    上菜: "Serving",
    收银: "Cashier",
    备菜: "Food prep",
    洗碗: "Dishwashing",
    厨房清洁: "Kitchen hand",
    点心制作: "Dim sum",
    理货: "Shelf stocking",
    门店管理: "Store management",
    美发: "Hairdressing",
    木工: "Carpentry",
    "Site Safe": "Site Safe",
    清洁: "Cleaning",
    仓储: "Warehouse",
    叉车: "Forklift",
    驾驶: "Driving",
    行政: "Office admin",
    客服: "Customer service",
  },

  role: {
    jobHasNoRoles: "The job has no role picked",
    wantedMissing: "Roles they want: not given yet",
    skillNote: (skills) => `; skills: ${skills}`,
    ticked: (roles, note) => `Picked ${roles}${note}`,
    mentioned: (roles, note) => `Profile mentions ${roles}${note}`,
    sameIndustry: (roles, industry, note) => `Wants ${roles}, also in the same industry (${industry})${note}`,
    wants: (roles, note) => `Wants ${roles}${note}`,
  },

  experience: {
    notRequired: "No minimum years asked",
    required: (years) =>
      years === 1 ? "At least 1 year of related experience" : `At least ${years} years of related experience`,
    missing: "Years of experience: not given yet",
    onResume: (years) =>
      years === 1 ? "CV says 1 year of related experience" : `CV says ${years} years of related experience`,
    unclear: "Related experience needs checking",
  },

  languages: {
    notLimited: "Any language",
    missing: "Languages: not given yet",
  },

  type: {
    missing: "Job type wanted: not given yet",
  },

  region: {
    missing: "Areas they can work in: not given yet",
  },

  hours: {
    job: (min, max) => `${min}${max !== min ? `–${max}` : ""} hours a week`,
    notFixed: "Hours not fixed",
    available: (min, max, shifts) => `Can work ${min}–${max} hours a week; ${shifts}`,
    shiftsUnknown: "shifts to be confirmed",
    missing: "Hours they can work: not given yet",
  },

  pay: {
    job: (min, max) => `$${min}${max ? `–${max}` : ""} an hour`,
    expected: (pay) => `Expects at least $${pay} an hour`,
    missing: "Expected pay: not given yet",
  },

  facts: {
    labels: {
      availability: "Availability",
      region: "Area",
      pay: "Expected pay",
      languages: "Languages",
      experience: "Experience",
    },
    joiner: " · ",
    hours: (min, max) => `${min}–${max} hours a week`,
    payFrom: (pay) => `From $${pay} an hour`,
    noExperience: "No experience",
    years: (years) => (years === 1 ? "1 year" : `${years} years`),
    missing: "Not given yet",
  },
};
