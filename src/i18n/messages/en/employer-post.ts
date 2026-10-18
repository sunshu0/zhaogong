// The English side of employer-post.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { employerPostMessages } from "@/i18n/messages/employer-post";

export const employerPostEn: Messages<(typeof employerPostMessages)["zh"]> = {
  pages: {
    postTitle: "Post a job",
    postDescription:
      "Paste your job message, have it turned into a Chinese and English job, and checked against the rules before you post.",
    editTitle: "Edit job",
    copyTitle: "Copy as a new job",
    republishTitle: "Repost a job",
  },

  postFlow: {
    restored: "Picking up where you left off (the draft is only kept in this tab).",
    startOver: "Clear and start over",
    stepFailedTitle: "This step didn't load",
    stepFailedNote: "What you filled in is still here. Tap Try again to carry on.",
  },

  postError: {
    title: "Something went wrong on the posting page",
    retry: "Try again",
    backToJobs: "Back to my jobs",
    body: "What you wrote is still kept in this tab. Tap Try again, or come back later and carry on.",
  },

  publishErrors: {
    signed_out: "Your sign-in has expired. Sign in again, then post.",
    no_identity: "You need to set up hiring first. Start again from “Post a job” at the top of the page.",
    banned: "This employer account has been stopped and can't post jobs.",
    not_ready: "The server checks didn't pass. Go back a step and fix it.",
  },

  steps: {
    listLabel: "Posting steps",
    chat: "Chat with the assistant",
    paste: "Paste",
    form: "Check",
    preview: "Preview and post",
    modeLabel: "How to post",
    modeChat: "Post with AI",
    modeForm: "Fill in the form",
    pasteHeading: "Post a job in a minute",
    pasteLabel:
      "Paste the job message from your WeChat group, or just write it: who you need, which area, and the pay per hour.",
    parsing: "Sorting it out…",
    parse: "Turn into a job",
    tryExample: "Try an example",
    emptyForm: "Skip pasting and fill in the form",
    formHeading: "Check the job details",
    previewHeading: "Preview: this is what job seekers see. If it all looks right, you can post it.",
    previewNeedsReview: "This job goes to a person for review first, and shows publicly once it's approved.",
    previewContactTitle: "Contact details",
    previewContactPublic: (kinds) => `Once signed in, job seekers can see the employer's ${kinds}.`,
    previewContactPrivate:
      "The employer's contact details are not public. A job seeker can ask to swap details in chat, and they are only swapped once both agree.",
    previewBanned: "This employer account has been stopped. All its jobs are taken down and it can't post any more.",
  },

  parseNotes: {
    otherPeriodPay: "The text gives a weekly, monthly or yearly wage. Work out the hourly rate and fill that in.",
  },

  bars: {
    back: "Back",
    preview: "Preview",
    readyNeedsReview: "Ready to post, needs review by a person",
    ready: "Ready to post",
    backToEdit: "Back to edit",
    postingAsBefore: "Posting as “",
    postingAsAfter: "”",
    holdReason: (problems, missing) =>
      [
        problems && (problems === 1 ? "1 problem to fix" : `${problems} problems to fix`),
        missing && (missing === 1 ? "1 field to fill in" : `${missing} fields to fill in`),
      ]
        .filter(Boolean)
        .join(", "),
    publishing: "Posting…",
    submitForReview: "Submit for review",
    publish: "Post",
  },

  chat: {
    heading: "Write your job with the posting assistant",
    scriptAssistant: "Development: a script assistant, not AI.",
    logLabel: "Chat with the posting assistant",
    fromAssistant: "Assistant:",
    fromYou: "You:",
    thinking: "The assistant is working on it…",
    quickRepliesLabel: "Quick replies",
    unavailable: "The AI posting assistant isn't available right now.",
    useFormInstead: "Fill in the form instead",
    sendFailed: "That didn't send. Try again.",
    inputLabel: "Reply to the assistant",
    inputPlaceholder: "Type your reply. Enter sends, Shift + Enter starts a new line",
    send: "Send",
    editInForm: "Edit in the form",
  },

  draftCard: {
    cardLabel: "Job card, updates as you chat",
    noTitle: "No job title yet",
    rolesPreselected: (names) => `Roles: ${names} (preselected from the job title, you can change them at preview)`,
    rolesToPick: "Roles: not chosen yet (choose at preview)",
    readyToPreview: "Ready to preview",
    filledIn: (done, total) => `${done} of ${total} filled in`,
    problems: (n) => (n === 1 ? " · 1 thing to fix" : ` · ${n} things to fix`),
    collapse: "Hide",
    expand: "See the list",
    needsReview: "Once posted, this job goes to a person for review.",
    toFill: "To fill in",
    optional: "Optional",
    change: "Change",
    fillIn: "Fill in",
  },

  checklist: {
    separator: ", ",
    titleLabel: "Job title",
    payLabel: "Pay",
    regionLabel: "Area",
    employmentTypeLabel: "Job type",
    visaLabel: "Visas",
    descriptionLabel: "Job description",
    contactLabel: "Contact details",
    hoursLabel: "Hours a week",
    perksLabel: "Meals and accommodation",
    payValue: (amount) => `${amount} an hour`,
    hoursValue: (range) => `${range} hours`,
    contactPrivate: "Private · swapped in chat",
    contactPublic: (kinds) => `Public: ${kinds}`,
    contactPhone: "Phone",
    contactWechat: "WeChat",
    contactEmail: "Email",
    meals: "Meals provided",
    accommodation: "Accommodation provided",
    noPerks: "No meals or accommodation",
  },

  form: {
    notRecognised: "Not picked up — please fill this in",
    chooseOne: "Choose one",
    rangeMin: "Lowest",
    rangeMax: "Highest (optional)",
    rangeMaxPlaceholder: "Optional",

    jobSection: "Job",
    titleZh: "Job title (Chinese)",
    titleZhPlaceholder: "e.g. 前厅服务员",
    titleEn: "Job title (English)",
    titleEnPlaceholder: "e.g. Front-of-house staff",
    industry: "Industry",
    urgent: "Urgent",
    employmentType: "Job type",

    placeSection: "Place and hours",
    region: "Area",
    address: "Address (optional)",
    hoursPerWeek: "Hours a week (optional)",
    hoursUnit: "hours",
    shifts: "Shifts (optional)",
    shiftsPlaceholder: "e.g. Weekend evenings",

    paySection: "Pay and extras",
    pay: "Pay per hour",
    payUnit: (symbol) => `an hour (${symbol})`,
    payHint: (country, amount, from) =>
      `Adult minimum wage in ${country}: ${amount} an hour (from ${from}). If there is only one figure, fill in the left box only.`,
    meals: "Meals provided",
    accommodation: "Accommodation provided",

    requirementsSection: "Requirements",
    visaAccepted: "Visas accepted",
    visaHint: "Only say which visas you accept. Don't write about arranging or selling visas.",
    languages: "Language requirements (optional)",

    descriptionSection: "Job description",
    descriptionZh: "Description (Chinese)",
    descriptionEn: "Description (English)",
    descriptionEnHint: "Written from the form, and you can change it.",
    regenerateEn: "Write it again from the form",

    contactSection: "Contact details",
    contactChoiceLegend: "How job seekers contact you",
    contactPrivateChoice: "Private — job seekers ask to swap in chat",
    contactPrivateNote: "Details are only swapped once you agree.",
    contactPublicChoice: "Public to signed-in job seekers",
    contactPublicNote: "Signed-in job seekers see them on the job page.",
    contactLegend: "Fill in at least one",
    contactHint: "Only signed-in job seekers can see them.",
    contactPhone: "Phone",
    contactPhonePlaceholder: "021 xxx xxxx",
    contactWechat: "WeChat ID",
    contactEmail: "Email",
    contactEmailPlaceholder: "name@example.com",
    contactPrivateBefore:
      "Nothing to fill in here. Put the details you swap with job seekers under “Private details for swaps” on your ",
    contactPrivateLink: "Business page",
    contactPrivateAfter: ".",
  },

  roles: {
    legend: "Roles",
    preselected: (names) => `Preselected from the job title: ${names}. You can change this.`,
    max: (max) => `Choose up to ${max}. Suggested candidates are matched by role.`,
    fallback: (names) => `If you choose none, the job title puts it under ${names}.`,
    none: "None chosen yet. The job will show “Roles not chosen yet”, and roles won't count towards suggested candidates.",
  },

  payReference: {
    chooseIndustry: "Once you choose an industry, pay for similar jobs shows here.",
  },

  findings: {
    title: "Checks before posting",
    levelSuffix: ": ",
    levelBlock: "Can't post",
    levelRewrite: "Please rewrite",
    levelReview: "Needs review",
    clean: "Checks before posting: nothing found",
    summary: (parts) => `Checks before posting: ${parts}`,
    summaryJoin: ", ",
    problemCount: (n) => (n === 1 ? "1 problem" : `${n} problems`),
    missingCount: (n) => (n === 1 ? "1 not filled in" : `${n} not filled in`),
    cleanNote: "Nothing found. You can preview and post.",
    missingLead: "Not filled in yet: ",
    missingJoin: ", ",
    footer:
      "We check the adult minimum wage and wording that breaks the rules: charging a fee for the job, selling or arranging visas, and hiring by race or nationality can't be posted. Some industries go to a person for review.",
    fields: {
      titleZh: "Job title (Chinese)",
      titleEn: "Job title (English)",
      industry: "Industry",
      employmentType: "Job type",
      regionId: "Area",
      address: "Address",
      pay: "Pay per hour",
      hoursPerWeek: "Hours a week",
      shiftsZh: "Shifts",
      visaAccepted: "Visas accepted",
      languages: "Language requirements",
      descriptionZh: "Description (Chinese)",
      descriptionEn: "Description (English)",
      contact: "Contact details",
    },
  },

  published: {
    live: "Posted",
    pendingReview: "Submitted for review",
    liveNote: "Job seekers can see it now.",
    pendingNote: "It shows publicly once it's approved. You can follow it under “My jobs”.",
    seeJobPage: "See the job page",
    pendingShare:
      "Once it's approved, you can copy the posts for WeChat groups, Xiaohongshu and Skykiwi under “My jobs”.",
    postAnother: "Post another",
    myJobs: "My jobs",
  },

  edit: {
    takenDown: "This job was taken down by the moderators and can't be changed.",
    notFound: "We can't find this job, or it doesn't belong to the business you're signed in as.",
    backToJobs: "Back to my jobs",
    heading: "Edit job",
    saved: "Saved",
    savedNeedsReview: "Your changes go to a person for review, and show publicly once approved.",
    savedLive: "Your changes are live.",
    seeJob: "See the job",
    cancel: "Cancel",
    readyNeedsReview: "Saving sends it for review again",
    ready: "Ready to save",
    saving: "Saving…",
    save: "Save",
  },

  republish: {
    notFound: "We can't find this job, or it doesn't belong to the business you're signed in as.",
    cannotCopy: "Jobs that are taken down or still under review can't be copied.",
    cannotRepublish:
      "Only a job that closed more than 14 days ago needs reposting. You can renew this one under My jobs.",
    backToJobs: "Back to my jobs",
    copyHeading: "Copy as a new job",
    republishHeading: "Repost",
    copyNoteBefore: "Makes a new job from “",
    copyNoteAfter:
      "”. Change what you need, then post. The new job starts fresh: none of the old job's applicants, renewals or view numbers, and the usual checks before posting. The old job stays as it is.",
    republishNoteBefore: "Makes a new job from “",
    republishNoteAfter: (closeDate) =>
      `” (closed ${closeDate}). It is checked again against today's rules, such as the adult minimum wage, before posting. The old job stays closed.`,
    cancel: "Cancel",
    readyNeedsReview: "Posting sends it for review",
    ready: "Ready to post",
    publishing: "Posting…",
    publish: "Post",
  },

  keptForm: {
    restored: "Picking up the changes you didn't save (they are only kept in this tab).",
    discard: "Discard changes",
    failedTitle: "The form didn't load",
    failedNote: "Your changes are still here. Tap Try again to carry on.",
  },
};
