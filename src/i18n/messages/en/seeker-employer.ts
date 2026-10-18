// The English side of seeker-employer.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { seekerEmployerMessages } from "@/i18n/messages/seeker-employer";

export const seekerEmployerEn: Messages<(typeof seekerEmployerMessages)["zh"]> = {
  title: (name) => `${name} · Business page`,
  missing: "Employer not found",
  loading: "Loading the business page…",
  back: "← Find jobs",
  eyebrow: (id) => `Business page · Demo business · ID: ${id}`,
  noRegion: "No area yet",
  chooseJob: "Choose a job and chat",
  noOpenJobs: "No open jobs right now",
  seeVerification: "See business verification",
  edit: "Edit the business page",
  about: "About the business",
  noAbout: "The employer hasn't written about the business yet.",
  address: "Workplace address",
  contactName: "Hiring contact",
  languages: "Languages spoken",
  contactHours: "When to contact",
  verification: "Business verification",
  legalName: "Legal name",
  accredited: "Accredited employer",
  accreditedYes: "Accredited (demo)",
  accreditedNone: "No accreditation details given",
  demoNote:
    "Demo registration and verification details. Business verification doesn't guarantee the working conditions.",
  manageVerification: "Manage business verification",
  openJobs: "Open jobs",
  openJobsCount: (n) => String(n),
  noJobs: "This employer has no open jobs right now.",
  notFilled: "Not filled in",
  notFound: {
    title: "This employer doesn't exist or is no longer active",
    others: "See other jobs",
    body: "The link may be wrong, or this employer no longer hires on 找工.",
  },
};
