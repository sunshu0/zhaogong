// When Microsoft Clarity may run and when to ask (#313, ADR 0025 §6–7). Pure: the loader and the consent prompt
// (components/analytics) decide with these, and the unit tests check them.

/** The visitor's answer, kept for a year: "clarity" agreed, "none" declined; no cookie means not asked or no answer. */
export const CONSENT_COOKIE = "zg_consent";
export type Consent = "clarity" | "none";

/** How many page loads the prompt shows on without an answer before it stops asking. */
export const MAX_PROMPTS = 3;

/**
 * Pages Clarity never records (ADR 0025 §6): contact details, CVs, chats, sign-in, the moderation pages and "我的",
 * and the internship section (under-18s, 待用户 ①). A page not listed by path (an internship's external job page)
 * says so itself with <NoClarity />.
 */
const NO_RECORD = [
  "/login",
  "/account",
  "/messages",
  "/notifications",
  "/workspace",
  "/profile",
  "/resume",
  "/candidates",
  "/me",
  "/admin",
  "/employer/verify",
  "/employer/team",
  "/internships",
];
const APPLICANTS = /^\/employer\/jobs\/[^/]+\/applicants$/;

export function isNoRecordPath(pathname: string): boolean {
  return APPLICANTS.test(pathname) || NO_RECORD.some((base) => pathname === base || pathname.startsWith(`${base}/`));
}

/** The answer in a Cookie header or document.cookie. */
export function parseConsent(cookies: string): Consent | null {
  const value = cookies
    .split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === CONSENT_COOKIE)?.[1];
  return value === "clarity" || value === "none" ? value : null;
}

export interface Setup {
  /** NEXT_PUBLIC_CLARITY_ID: Clarity is set up for this build only with it. */
  projectId: string | undefined;
  production: boolean;
  /** The browser tests' build (ZG_E2E=1): it may ask, to test the prompt, but never loads Clarity. */
  testBuild: boolean;
}

/** Whether this build asks at all: a project to send to, and not a development server. */
export function clarityConfigured({ projectId, production }: Setup): boolean {
  return !!projectId && production;
}

/** Whether to load Clarity on this page now (ADR 0025 §6): set up, not the test build, agreed, a page it may record. */
export function shouldLoadClarity(
  setup: Setup,
  consent: Consent | null,
  pathname: string,
  pageOptedOut: boolean,
): boolean {
  return (
    clarityConfigured(setup) && !setup.testBuild && consent === "clarity" && !pageOptedOut && !isNoRecordPath(pathname)
  );
}

/** Whether the prompt shows by itself: set up, no answer yet, and asked fewer than MAX_PROMPTS times. */
export function shouldPrompt(setup: Setup, consent: Consent | null, timesShown: number): boolean {
  return clarityConfigured(setup) && consent === null && timesShown < MAX_PROMPTS;
}

/** The Set-Cookie value for an answer: a year, the whole site, readable by the page. */
export function consentCookie(consent: Consent, secure: boolean): string {
  return `${CONSENT_COOKIE}=${consent}; Max-Age=${365 * 24 * 3600}; Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
}
