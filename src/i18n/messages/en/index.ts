// #240: every dictionary's English side, by the key its Chinese side carries (src/i18n/messages/<module>.ts). Only
// src/i18n/english.ts imports this: at once on the server, and in the browser as its own chunk on English pages.
// scripts/i18n-split-en.mjs adds the lines; keep the two markers.
import { uiEn } from "./ui";
import { seekerJobsEn } from "./seeker-jobs";
import { seekerMeEn } from "./seeker-me";
import { seekerProfileEn } from "./seeker-profile";
import { seekerHomeEn } from "./seeker-home";
import { seekerEmployerEn } from "./seeker-employer";
import { employerPostEn } from "./employer-post";
import { employerJobsEn } from "./employer-jobs";
import { employerApplicantsEn } from "./employer-applicants";
import { employerTeamEn } from "./employer-team";
import { employerVerifyEn } from "./employer-verify";
import { employerCommonEn } from "./employer-common";
import { employerPageEn } from "./employer-page";
import { chatEn } from "./chat";
import { complianceEn } from "./compliance";
import { candidateMatchingEn } from "./candidate-matching";
import { loginEn } from "./login";
import { accountEn } from "./account";
import { notificationsEn } from "./notifications";
import { adminEn } from "./admin";
import { adminStatsEn } from "./admin-stats";
import { adminVerificationEn } from "./admin-verification";
import { adminExternalEn } from "./admin-external";
import { externalEn } from "./external";
import { legalPrivacyEn } from "./legal-privacy";
import { legalTermsEn } from "./legal-terms";
import { aboutEn } from "./about";
import { adminViewsEn } from "./admin-views";
import { safetyEn } from "./safety";
import { myReportsEn } from "./my-reports";
// imports (scripts/i18n-split-en.mjs)

export const english: Record<string, unknown> = {
  ui: uiEn,
  seekerJobs: seekerJobsEn,
  seekerMe: seekerMeEn,
  seekerProfile: seekerProfileEn,
  seekerHome: seekerHomeEn,
  seekerEmployer: seekerEmployerEn,
  employerPost: employerPostEn,
  employerJobs: employerJobsEn,
  employerApplicants: employerApplicantsEn,
  employerTeam: employerTeamEn,
  employerVerify: employerVerifyEn,
  employerCommon: employerCommonEn,
  employerPage: employerPageEn,
  chat: chatEn,
  compliance: complianceEn,
  candidateMatching: candidateMatchingEn,
  login: loginEn,
  account: accountEn,
  notifications: notificationsEn,
  admin: adminEn,
  adminStats: adminStatsEn,
  adminVerification: adminVerificationEn,
  adminExternal: adminExternalEn,
  external: externalEn,
  legalPrivacy: legalPrivacyEn,
  legalTerms: legalTermsEn,
  about: aboutEn,
  adminViews: adminViewsEn,
  safety: safetyEn,
  myReports: myReportsEn,
  // entries (scripts/i18n-split-en.mjs)
};
