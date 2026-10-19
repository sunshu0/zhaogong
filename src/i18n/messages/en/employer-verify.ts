// The English side of employer-verify.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { employerVerifyMessages } from "@/i18n/messages/employer-verify";

export const employerVerifyEn: Messages<(typeof employerVerifyMessages)["zh"]> = {
  page: {
    title: "Business verification",
    description:
      "Check your business against the New Zealand business register by name or NZBN, and show the Verified business badge on your jobs.",
  },

  verify: {
    heading: "Business verification",
    nowIs: " is currently",
    nzbn: (number) => `NZBN ${number}`,
    submitted: "Sent. A moderator will check it and tell you the result in your notifications.",
    banned: "This account is suspended, so it cannot apply for verification.",
    nothingLeft: (badge) => `Your business is already "${badge}", so there is nothing to apply for.`,
    adminOnlyBefore: "Only a team admin can apply for business verification. Ask an admin (",
    adminsJoiner: ", ",
    adminOnlyAfter: ").",
    backToJobs: "Back to my jobs",
  },

  request: {
    sectionLabel: "Verification application",
    pendingTitle: "Verification under review",
    approvedTitle: (badge) => `Approved: ${badge}`,
    rejectedTitle: "Your last application was not approved",
    pendingNote:
      "A moderator checks the business register and calls the business phone number listed in public sources to confirm that you work there. You can keep posting jobs while they check; your badge stays Not verified. You will get the result in your notifications.",
    rejectionJoiner: ": ",
    appliedFor: "Applied for",
    business: "Business",
    contact: "Contact",
    sentAt: "Sent",
    contactRoleOpen: " (",
    contactRoleClose: ") · ",
  },

  form: {
    againTitle: "Fix the details and apply again",
    findTitle: "1. Find your business in the business register",
    queryLabel: "Business name or NZBN",
    queryPlaceholder: "For example: Demo Yuemei or 9429000000004",
    search: "Search",
    demoRegisterNote:
      "The demo searches a sample register. The real site connects to the New Zealand Business Number (NZBN) register.",
    foundCount: (n) => (n === 1 ? "Found 1 business. Choose yours." : `Found ${n} businesses. Choose yours.`),
    resultLine: (nzbn) => `NZBN ${nzbn} · Trading names: `,
    namesJoiner: ", ",
    statusRegistered: "Register status: registered",
    statusRemoved: "Register status: removed",
    choose: "This is my business",
    whoTitle: "2. Who is applying",
    changeBusiness: "Choose another",
    kindLegend: "Which badge are you applying for",
    kindBusinessVerified: "Verified business: the business really exists in the business register",
    kindAccredited: "Accredited employer: the business is on Immigration New Zealand's public accredited employer list",
    contactNameLabel: "Contact name",
    contactRoleLabel: "Your role in the business",
    contactRolePlaceholder: "For example: director, owner, manager",
    companyPhoneLabel: "Business phone number",
    companyPhoneHint:
      "Give the number the business lists publicly. A moderator calls the business number they find in public sources, not only this one.",
    websiteLabel: "Website or Facebook page (optional)",
    websitePlaceholder: "https://",
    submit: "Submit for review",
    submitting: "Sending…",
  },

  meaning: {
    isTitle: 'What "Verified business" means',
    isBody:
      "A moderator checked the New Zealand business register: the business exists, its registration is current, and they called the business phone number listed in public sources to confirm that the applicant works there. Jobs show the registered business name and NZBN. Job seekers are more willing to contact an employer with a badge.",
    isNotTitle: "What it does not mean",
    isNotPoints: [
      "It is not our guarantee of pay, hours or working conditions.",
      '"Accredited employer" only means the business is on Immigration New Zealand\'s public accredited employer list. Neither badge means any visa can be arranged.',
      "It does not endorse what a job says. Job seekers can still report a job that charges a fee, pays below the adult minimum wage, or anything else.",
    ],
  },

  rejectReasons: {
    register_mismatch: "Doesn't match the register",
    phone_unreachable: "Couldn't reach anyone by phone",
    impersonation: "Using another business's identity",
    other: "Other",
  },

  checklist: {
    register: {
      label: "Business register",
      detail: "This NZBN is registered, and the legal business name matches the business name the employer gave.",
      nzbnLink: "Check the NZBN register",
      companiesOfficeLink: "Check the Companies Office",
    },
    applicant: {
      label: "Who is applying",
      detail:
        "The applicant's name is on the register as a director or shareholder. If it is not, confirm their role in the business on the phone call in the next step.",
      directorsLink: "Check directors and shareholders",
    },
    phone: {
      label: "Phone check",
      detail:
        "Call the business number you find in public sources (its website, Google Maps, the register), not the number the applicant gave, and ask whether this person posts jobs on 找工 for the business.",
      mapsLink: "Find the number on Google Maps",
    },
    website: {
      label: "Website or Facebook",
      detail: "It exists and is the same business (address and name match). Skip it if there is none.",
    },
    accredited: {
      label: "Accredited employer list",
      detail:
        "Find the business by NZBN or name on Immigration New Zealand's public accredited employer list, with a current status.",
      listLink: "Check the accredited employer list",
    },
  },

  errors: {
    noRejectReason: "Choose a reason for rejecting it.",
    noRejectNote: "Write a note about the rejection. The employer will see it.",
    noBusinessChosen: "Choose your business in the business register first.",
    noContactName: "Enter the contact name.",
    noContactRole: "Enter your role in the business.",
    badPhone: "Enter the business phone number (digits, and + and spaces if you need them).",
    badWebsite: "Enter the full web address of the website or Facebook page, starting with http:// or https://.",
  },

  register: {
    nzbnLength: "An NZBN is 13 digits. Check the number.",
    nzbnNotFound: "That NZBN is not in the business register.",
    queryTooShort: "Enter at least two characters.",
    nameNotFound: "Nothing found in the business register. Try another name, or enter the NZBN.",
  },

  notifications: {
    type: "Verification",
    approvedTitle: (badge) => `Business verification approved: ${badge}`,
    rejectedTitle: "Business verification was not approved",
    approvedDetail: (badge) => `Your jobs will show "${badge}" and your registered business name.`,
    rejectedDetail: (reason, note) => `${reason}: ${note}. Fix the details and apply again.`,
  },
};
