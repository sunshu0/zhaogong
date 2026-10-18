// The English side of chat.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { chatMessages } from "@/i18n/messages/chat";

export const chatEn: Messages<(typeof chatMessages)["zh"]> = {
  page: {
    title: "Chat",
    suspense: "Loading the chat…",
    loading: "Loading the chat",
  },

  errorPage: {
    title: "Something went wrong with the chat page",
    body: "Messages you sent that have not arrived yet stay on this device, and go out next time the chat page opens.",
    retry: "Try again",
    backToWorkspace: "Back to the workspace",
  },

  retryBoundary: {
    retry: "Try again",
  },

  workspace: {
    headingEmployer: "Hiring chat",
    headingSeeker: "Job chat",
    unreadCount: (n) => (n === 1 ? "1 unread message" : `${n} unread messages`),
    allRead: "All messages read",
    demoData: "Demo data",
    threadFailedTitle: "This chat didn't open",
    threadFailedNote: "Anything you typed is still in the box. Tap Try again to open it.",
    demoFooter: "Demo account: the contacts here and their replies are demo content.",
    footer:
      "Messages are kept on the server and both sides see them. A new message from the other person shows on this page within 10 seconds.",
    listLabel: "Chats",
    recent: "Recent chats",
    conversationCount: (n) => (n === 1 ? "1 chat" : `${n} chats`),
    /** Followed on the same line by emptyEmployer or emptySeeker, so it ends with the space between them. */
    empty: "No chats yet. ",
    emptyEmployer: 'Tap "Start a chat" in the applicants list or suggested candidates and it will show here.',
    emptySeeker: 'Tap "Chat now" on a job and it will show here.',
    previewEmpty: "No messages yet",
    pickerLabel: "Choose a chat",
    pickerTitle: "Choose someone to chat with",
    pickerUnread: (n) => (n === 1 ? "You have 1 unread message" : `You have ${n} unread messages`),
    pickerNoUnread: "No unread messages",
  },

  thread: {
    label: (person) => `Chat with ${person}`,
    seekerProfile: "Profile",
    employerProfile: "Business page",
    viewJob: "View the job",
    report: "Report",
    back: "Back to the chat list",
    more: (person) => `More: ${person}`,
    viewProfile: (person) => `View ${person}'s page`,
    appliedFor: "Applying for: ",
    hiringFor: "Hiring for: ",
    composerLabel: "Write a message",
    composerPlaceholder: "Write a message…",
    send: "Send",
  },

  conversationJob: {
    label: "Job",
    link: (title) => `This chat is about ${title}. View the job.`,
    linkWithPay: (title, pay) => `This chat is about ${title}, ${pay}. View the job.`,
    closed: "No longer hiring",
  },

  log: {
    label: "Messages",
    empty: "No messages yet",
    counterpartRead: (state) => `The other person: ${state}`,
    warningsLabel: "Rule reminder",
    reportMessage: "Report this message",
  },

  times: {
    yesterday: "Yesterday",
    justNow: "Just now",
    withheld: "Details",
    seekerName: "Job seeker",
    weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    minutesAgo: (n) => (n === 1 ? "1 minute ago" : `${n} minutes ago`),
    hoursAgo: (n) => (n === 1 ? "1 hour ago" : `${n} hours ago`),
  },

  activity: {
    chatLabel: "Chat status",
    employerSummaryLabel: "How this employer replies",
    employerJobLabel: "How this employer replies about jobs",
    counterpart: (state) => `The other person: ${state}`,
    /** The English states say "Last online …" themselves, so the line needs nothing around them. */
    lastSeen: (state) => state,
    loadingLastActive: "Loading when they were last online",
    repliedByMe: (n) =>
      n === 1 ? "You have replied to 1 job seeker today" : `You have replied to ${n} job seekers today`,
    repliedByEmployer: (n) =>
      n === 1 ? "The employer has replied to 1 job seeker today" : `The employer has replied to ${n} job seekers today`,
    repliedToday: (n) => (n === 1 ? "Replied to 1 job seeker today" : `Replied to ${n} job seekers today`),
    noEmployerReplies: "No record of the employer's replies today",
    noRepliesToday: "No record of replies today",
    demo: "Demo status",
    read: "Read",
    readByMe: "I have read it",
    unread: "Unread",
    readUnknown: "Read status unknown",
    unreadByMe: "I have not read it",
    /** Each one says "last online" itself: they are read on their own, after 「对方」, and after 「最近在线：」. */
    lastActiveUnknown: "Last online not known",
    onlineJustNow: "Last online just now",
    onlineMinutes: (n) => (n === 1 ? "Last online about 1 minute ago" : `Last online about ${n} minutes ago`),
    onlineHours: (n) => (n === 1 ? "Last online about 1 hour ago" : `Last online about ${n} hours ago`),
    onlineDays: (n) => (n === 1 ? "Last online about 1 day ago" : `Last online about ${n} days ago`),
    onlineOverAWeek: "Last online over a week ago",
  },

  /** Always read inside a sentence ("Ask to swap contact details"), so it is not capitalised. */
  exchangeKinds: {
    contact: "contact details",
    resume: "CV and business details",
  },

  payloadFields: {
    phone: "Phone",
    wechat: "WeChat",
    email: "Email",
    businessName: "Business",
    personName: "Name",
    headline: "Headline",
    businessBio: "About the business",
    personBio: "About me",
    languages: "Languages",
    availability: "Availability",
    skills: "Skills",
    experience: "Experience in the role",
    experienceYears: (years) => (years === 1 ? "1 year" : `${years} years`),
    wanted: "Looking for",
  },

  exchangeMenu: {
    buttonLabel: "Swap details or contact details",
    groupLabel: "Chat tools",
    resume: "Swap details",
    contact: "Swap contact details",
    done: "Swapped",
    waiting: "Waiting to agree",
  },

  exchange: {
    label: (kind) => `Request to swap ${kind}`,
    titleMine: (kind) => `You asked to swap ${kind}`,
    titleTheirs: (kind) => `They asked to swap ${kind}`,
    demo: "Demo request",
    pendingMine:
      "You have given your details and the other person can see them now. Once they agree, you will see theirs.",
    pendingTheirs:
      "The other person gave their details first. They see yours only after you agree, and you can refuse.",
    rejectedMine: "They refused, so they gave nothing.",
    rejectedTheirs: "You refused, so your details were not given.",
    cancelledMine: "The request was withdrawn, so the other person no longer sees your details.",
    cancelledTheirs: "The request was withdrawn and their details were taken back.",
    accepted: "Both sides agreed and the details are swapped.",
    theirPayload: "Their details",
    myPayloadPending: "What I am giving",
    myPayload: "My details",
    withdraw: "Withdraw the request",
    viewAndAgree: "View and agree",
    refuse: "Refuse",
  },

  exchangeDialog: {
    agreeTitle: (kind) => `Agree to swap ${kind}`,
    askTitle: (kind) => `Ask to swap ${kind}`,
    agreeNote: "The other person has already given their details. If you agree, they will see these details of yours.",
    askNote:
      "Whoever asks gives their own details first: as soon as you send the request, the other person can see these details of yours, and you see theirs only after they agree.",
    mineLabel: "What I am giving",
    agreeHeading: "What they get if you agree",
    askHeading: "What they get when you send the request",
    nothingYet: (kind) => `You have not filled in your ${kind} yet. `,
    nothingYetAgree: "Fill it in before you can agree to a swap.",
    nothingYetAsk: "Fill in yours first, then you can ask for a swap.",
    editMine: "Edit my details",
    fillMine: (kind) => `Add ${kind} on your profile`,
    keepNote:
      "The other person may keep what you give them. If they refuse, they give nothing back; if you withdraw the request, they stop seeing your details.",
    cancel: "Cancel",
    agree: "Agree and swap both sides",
    ask: "Send the request",
  },

  reportReasons: {
    harassment: "Harassment, abuse or threats",
    fraud: "A scam or false information",
    fees: "Charges a deposit, a placement fee or another fee",
    privacy: "Shares private details or pretends to be someone else",
    discrimination: "Discrimination or unfair hiring requirements",
    illegal: "Other illegal behaviour or rule breaking",
    other: "Something else",
  },

  report: {
    buttonLabel: "Report this chat",
    buttonTitle: "Report the other person",
    dialogTitle: "Report the other person",
    sentTitle: "Report saved",
    sentNote:
      "Demo: the report and the chat evidence are saved on this device only. Nothing has gone to 找工 yet, and the other person is not told.",
    close: "Close",
    toast: "Report saved",
    targetBefore: "Reporting: ",
    targetAfter: (role) => ` · ${role}`,
    roleSeeker: "Job seeker",
    roleEmployer: "Employer",
    reasonLabel: "Reason",
    reasonPlaceholder: "Choose one",
    rangeLabel: "What to report",
    rangePlaceholder: "The whole chat (last 100 messages)",
    messageOption: (number, text) => `${number}. ${text}`,
    noteRequired: "More detail (required)",
    noteOptional: "More detail (optional)",
    evidenceNote:
      "The report includes the chat you chose, and is used only to deal with the report. In this demo it stays on this device.",
    noReason: "Choose a reason",
    noNote: "Say what the problem is",
    notSaved: "The report wasn't saved. Try again.",
    cancel: "Cancel",
    submit: "Send the report",
    history: (n) => `Reports saved on this device (${n})`,
    noExtraNote: "No extra detail",
  },

  warnings: {
    feeForbidden: "找工 does not allow asking job seekers for a deposit or any fee",
    feeCaution: "Be careful: do not pay anything first. You can report it.",
    visaSellingForbidden: "找工 does not allow hiring by offering to arrange a visa or residence",
    visaSellingCaution: "Be careful. You can report it.",
    ethnicForbidden: "找工 does not allow hiring by race or nationality",
    ethnicCaution: "Be careful. You can report it.",
    incoming: (forbidden, caution) => `${forbidden}. ${caution}`,
    outgoingBefore: "This message mentions ",
    outgoingAfter: (forbidden) => `: ${forbidden}. Consider changing it before you send.`,
    forbiddenJoiner: "; ",
  },

  notifications: {
    type: "Alert",
    alertTitle: (alertName) => `A new job matches your alert "${alertName}"`,
    hiring: (business, title) => `${business} is hiring: ${title}`,
    noLongerHiring: (title) => `${title} is no longer hiring`,
    thisJob: "This job",
  },
};
