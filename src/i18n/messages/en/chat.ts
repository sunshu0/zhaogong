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
    filterLabel: "Show by status",
    filters: { all: "All", new: "New", talking: "Talking", interview: "Interview" },
    filterEmpty: (filter) => `No chats in “${filter}” yet.`,
    pinned: "Pinned",
    markedUnread: "Marked unread",
    /** Followed on the same line by emptyEmployer or emptySeeker, so it ends with the space between them. */
    empty: "No chats yet. ",
    emptyEmployer:
      "When a job seeker messages you about a job, or you tap “Start a chat” in suggested candidates, it will show here.",
    emptySeeker: "Tap “Chat now” on a job and it will show here.",
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
    pin: "Pin to top",
    unpin: "Unpin",
    markUnread: "Mark as unread",
    back: "Back to the chat list",
    paused: "The other side can't reply for now, so messages can't be sent here.",
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
    linkWithPay: (title, pay, closed) =>
      `This chat is about ${title}, ${pay}.${closed ? " No longer hiring." : ""} View the job.`,
    closed: "No longer hiring",
  },

  delivery: {
    waiting: (count) =>
      `${count} ${count === 1 ? "item hasn't" : "items haven't"} reached the server yet. They'll be sent again once you're back online.`,
    unreached: "Can't reach the server, so messages may not be up to date.",
    retry: "Try again",
    unsent: "Not sent yet",
    openFailed: "Network problem: the chat didn't open. Try again later.",
    openRefused:
      "The chat didn't open: the job may have closed, or the person is no longer listed. Reload the page to check.",
  },
  limits: {
    messagesFull: (max) =>
      `This conversation already has ${max} messages, the most it can hold, so this one wasn't sent.`,
    otherSideBanned: "The other side can't reply for now, so this wasn't sent.",
    ownSideBanned: "Your business is restricted for now and can't send messages, so this wasn't sent.",
    conversationsFull: (max) =>
      `You already have ${max} conversations like this, the most allowed, so a new chat didn't open.`,
    importTooBig: "The older chat records on this device are too many to keep, so they weren't saved to the server.",
    reportsFull: (max) => `You already have ${max} chat reports saved, the most allowed, so this one wasn't saved.`,
    pinsFull: (max) => `You can pin up to ${max} chats. Unpin one first.`,
  },
  log: {
    label: "Messages",
    empty: "No messages yet",
    counterpart: "The other person: ",
    warningsLabel: "Rule reminder",
    sentWarningsLabel: "Rule reminder on your message",
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

  resumeSend: {
    tool: "Send my CV",
    title: "Send my CV",
    note: "They get a CV card that opens your CV in Chinese and English, the same one your CV (Chinese and English) page prints.",
    carries: (list) => `This CV includes: ${list}`,
    carriesNone: "This CV has no contact details",
    listJoin: ", ",
    contactNames: { phone: "phone", wechat: "WeChat", email: "email" },
    change: "Change",
    keepNote:
      "Everyone in the business's team can see it, and they may keep it. Changing your CV afterwards does not change this one; you can send it again.",
    noResume: "You have no CV to send yet: add your name on your profile, then make your CV.",
    makeResume: "Make my CV",
    cancel: "Cancel",
    send: "Send CV",
  },

  resumeCard: {
    text: (name) => `[CV] ${name}`,
    label: (name) => `CV of ${name}`,
    heading: "CV",
    carries: (list) => `Contact details: ${list}`,
    carriesNone: "No contact details",
    open: "View CV",
    sending: "Sending…",
  },

  resumePage: {
    title: "A CV from a chat",
    loading: "Loading the CV",
    back: "Back to the chat",
    sentTo: (date) => `Sent in a chat on ${date} to `,
    notFound: "You cannot see this CV",
    notFoundBody:
      "Only the job seeker who sent it and the business team that got it can see it. Sign in as the right one, or open it from the chat.",
    toChat: "Go to chat",
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
      "The report and the chat you chose are saved on 找工's server. Chat reports aren't handled by a person yet, and the other person is not told.",
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
      "The report includes the chat you chose, which is saved with it on 找工's server and used only to deal with the report.",
    noReason: "Choose a reason",
    noNote: "Say what the problem is",
    notSaved: "The report wasn't saved. Try again.",
    cancel: "Cancel",
    submit: "Send the report",
    history: (n) => `Your reports (${n})`,
    noExtraNote: "No extra detail",
  },

  warnings: {
    feeForbidden: "找工 does not allow asking job seekers for a deposit or any fee",
    feeCaution: "Be careful: do not pay anything first. You can report it.",
    visaSellingForbidden: "找工 does not allow hiring by offering to arrange a visa or residence",
    visaSellingCaution: "Be careful. You can report it.",
    taskScamForbidden: "找工 does not allow hiring for order brushing, fake reviews or tasks you pay for first",
    taskScamCaution: "These are often scams: do not pay anything in. You can report it.",
    ethnicForbidden: "找工 does not allow hiring by race or nationality",
    ethnicCaution: "Be careful. You can report it.",
    incoming: (forbidden, caution) => `${forbidden}. ${caution}`,
    outgoingBefore: "This message mentions ",
    outgoingAfter: (forbidden) => `: ${forbidden}. Consider changing it before you send.`,
    sentAfter: (forbidden) => `: ${forbidden}. The other person sees a reminder.`,
    forbiddenJoiner: "; ",
  },

  notifications: {
    type: "Alert",
    alertTitle: (alertName) => `A new job matches your alert "${alertName}"`,
    hiring: (business, title) => `${business} is hiring: ${title}`,
    noLongerHiring: (title) => `${title} is no longer hiring`,
    thisJob: "This job",
  },

  phrases: {
    rowLabel: "Quick replies",
    sendPhrase: (phrase) => `Send the quick reply: ${phrase}`,
    manage: "Edit",
    manageLabel: "Edit quick replies and the opening message",
    dialogTitle: "Quick replies and opening message",
    listHeading: "Quick replies",
    listNote: (max, length) =>
      `One press sends a reply. Up to ${max} replies, ${length} characters each. No phone, WeChat or email: to swap contact details, ask for an exchange in the chat.`,
    phraseLabel: (n) => `Quick reply ${n}`,
    moveUp: (n) => `Move reply ${n} up`,
    moveDown: (n) => `Move reply ${n} down`,
    remove: (n) => `Delete reply ${n}`,
    add: "Add a reply",
    restore: "Restore the defaults",
    openerHeading: "Opening message",
    openerNote:
      "When you press Chat now on a job to start a new chat, it goes into the message box. It is not sent by itself: read it, change it if you like, then press Send. {job} becomes the job's name.",
    openerTemplate: (n) => `Template ${n}: `,
    openerOwn: "Write my own",
    openerOwnLabel: "My own opening message",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    notSaved: "It was not saved. Please try again later.",
    tooMany: (max) => `Up to ${max} quick replies.`,
    tooLong: (n, max) => `Reply ${n} is longer than ${max} characters.`,
    openerTooLong: (max) => `The opening message can be up to ${max} characters.`,
    openerEmpty: "Your own opening message is still empty.",
    contact: (n, found) => `Reply ${n} has contact details (${found}). Please take them out and save again.`,
    openerContact: (found) =>
      `The opening message has contact details (${found}). Please take them out and save again.`,
    foundJoiner: ", ",
    seekerDefaults: [
      "Is this role still open?",
      "Roughly how many shifts a week, and how many hours each?",
      "When would suit you for an interview?",
      "I've sent you my CV. Thanks for taking a look.",
      "Great, thank you. I'll be there on time.",
    ],
    employerDefaults: [
      "Hi, I've read your profile. Do you have a moment to chat?",
      "Which days and times can you work each week?",
      "Have you done similar work before?",
      "When would suit you for an interview?",
      "Thanks for your interest. This role has now been filled.",
    ],
    openers: [
      "Hi, I'm interested in the {job} role and would like to know more. Do you have a moment to chat?",
      "Hi, I'd like to apply for the {job} role. My profile and CV are on my page. Thank you for taking a look!",
      "Hi, is the {job} role still open? I can start soon.",
    ],
  },
};
