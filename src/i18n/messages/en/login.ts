// The English side of login.ts (#240): the browser loads it on English pages only (src/i18n/english.ts).
// Typed by the Chinese side: a missing key, an extra key or a different parameter fails tsc.

import type { Messages } from "@/i18n/messages";
import type { loginMessages } from "@/i18n/messages/login";

export const loginEn: Messages<(typeof loginMessages)["zh"]> = {
  title: "Sign in or sign up",
  noMailer: {
    title: "You can't sign in on this demo site yet",
    body: "Sign-in codes are sent by email, and the demo site has no email service yet. You can still browse jobs, business pages and external jobs.",
    browse: "Browse jobs",
  },
  intro:
    "Sign in or sign up with a code sent to your email — no password. One account can look for work and set up hiring too.",
  loading: "Loading",
  checkingAccount: "Checking your account…",
  accountWhat: "your account's details",
  noScript: "Signing in needs JavaScript turned on. You can see the job list and job pages without signing in.",
  networkError: "Couldn't reach 找工. Try again in a moment.",
  roles: {
    legend: "What do you want to do?",
    seekerTitle: "Find a job",
    seekerText: "Browse jobs, chat with employers and swap contact details",
    employerTitle: "Hire people",
    employerText: "Set up hiring, choose or add your business, then post jobs",
  },
  signedIn: {
    as: "You're signed in as ",
    continue: "Continue",
    setUpHiring: "Set up hiring",
    signOut: "Sign out",
  },
  email: {
    label: "Email",
    invalid: "Enter a valid email address",
    send: "Send code",
    sending: "Sending…",
    note: "A new email address signs you up. Your email is only for signing in; employers never see it.",
    typoAnnounce: (fix) => `Did you mean ${fix}?`,
    typoBefore: "Did you mean",
    typoAfter: "?",
    typoFixLabel: (fix) => `Change to ${fix}`,
  },
  code: {
    sentTo: "We sent a sign-in code to",
    typoQuestion: "Is the address misspelt?",
    useInstead: (fix) => `Use ${fix}`,
    devNote: "No mail service in development: the code is in the server log:",
    validity: (minutes, resendMinutes) =>
      `The code works for ${minutes} minutes. No email? You can ask for a new one after ${resendMinutes === 1 ? "a minute" : `${resendMinutes} minutes`}.`,
    label: "Sign-in code",
    placeholder: "6 digits",
    invalid: "Enter the 6-digit code",
    submit: "Sign in",
    resend: "Send a new code",
    resendIn: (seconds) => `New code in ${seconds} s`,
    otherEmail: "Use another email",
  },
  errors: {
    sentRecently: (seconds) => `We just sent a code. You can ask for another in ${seconds} s.`,
    noMailService: "Email isn't set up yet, so we can't send codes for now.",
    sendFailed: "We couldn't send the code. Please try again later.",
    noCode: "Ask for a code first",
    expired: "The code has expired. Ask for a new one.",
    tooManyTries: "Too many wrong tries. Ask for a new code.",
    limited: {
      ip: (wait) => `Too many codes asked for or checked from this network. Try again in ${wait}.`,
      email: (wait) => `Too many codes asked for or checked for this email today. Try again in ${wait}.`,
      site: (wait) => `A lot of people are asking for codes right now. Try again in ${wait}.`,
    },
    waitText: (seconds) => {
      if (seconds < 3600) {
        const minutes = Math.max(1, Math.ceil(seconds / 60));
        return minutes === 1 ? "1 minute" : `${minutes} minutes`;
      }
      const hours = Math.ceil(seconds / 3600);
      return hours === 1 ? "1 hour" : `${hours} hours`;
    },
    wrongCode: (left) =>
      left === 1 ? "That code isn't right. 1 try left." : `That code isn't right. ${left} tries left.`,
    signInFirst: "Sign in first",
    employerFirst: "Set up hiring first",
  },
  hiring: {
    title: "Set up hiring",
    signedInAs: "Signed in as ",
    introAfter:
      ". Choose your business; the jobs you post show it. In the demo you can pick a demo shop below or add a business.",
    legend: "Your business",
    businessMeta: (area, verification, claimed) =>
      `${area} · ${verification}${claimed ? " · Has a team: ask its admin for an invite" : ""}`,
    newTitle: "Add a business",
    newText: "Enter the business name and area; business verification can wait",
    nameLabel: "Business name",
    areaLabel: "Area",
    areaPlaceholder: "Choose",
    submit: "Set up and start posting",
    submitting: "Setting up…",
  },
  identity: {
    nameMissing: "Enter the business name",
    nameTooLong: (max) => `The business name can be ${max} characters at most`,
    areaMissing: "Choose an area",
    businessMissing: "Choose a business",
    seeker: "Job seeker",
    employerOf: (business) => `Employer · ${business}`,
    claimed: "A team already runs this business. Ask its admin to invite you under Team, or add a business.",
    suspended: "This business has been suspended and can't be added.",
    notFound: "We couldn't find this business. Choose again.",
    alreadyBound: "This account already belongs to another business.",
  },
  mail: {
    subject: (code) => `Your 找工 sign-in code: ${code}`,
    body: (code, minutes) =>
      `Your 找工 sign-in code is ${code}. It works for ${minutes} minutes.\n\nIf you didn't try to sign in, you can ignore this email: no one can sign in to your account without the code.`,
  },
};
