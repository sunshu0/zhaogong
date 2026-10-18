// #240: every dictionary's English side, by the key its Chinese side carries (src/i18n/messages/<module>.ts). Only
// src/i18n/english.ts imports this: at once on the server, and in the browser as its own chunk on English pages.
// scripts/i18n-split-en.mjs adds the lines; keep the two markers.
import { uiEn } from "./ui";
import { seekerJobsEn } from "./seeker-jobs";
import { seekerMeEn } from "./seeker-me";
import { seekerProfileEn } from "./seeker-profile";
import { seekerHomeEn } from "./seeker-home";
import { seekerEmployerEn } from "./seeker-employer";
// imports (scripts/i18n-split-en.mjs)

export const english: Record<string, unknown> = {
  ui: uiEn,
  seekerJobs: seekerJobsEn,
  seekerMe: seekerMeEn,
  seekerProfile: seekerProfileEn,
  seekerHome: seekerHomeEn,
  seekerEmployer: seekerEmployerEn,
  // entries (scripts/i18n-split-en.mjs)
};
