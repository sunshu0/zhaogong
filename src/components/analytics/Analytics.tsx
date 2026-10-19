"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { useLang, useMessages, useSitePathname } from "@/i18n/client";
import { uiMessages } from "@/i18n/messages/ui";
import {
  clarityConfigured,
  consentCookie,
  isNoRecordPath,
  parseConsent,
  shouldLoadClarity,
  shouldPrompt,
  type Consent,
} from "@/lib/analytics/clarity-rules";
import {
  CLARITY_SETUP as SETUP,
  NO_CLARITY_FLAG,
  OPEN_CONSENT_EVENT,
  type ClarityFn,
} from "@/components/analytics/flags";

// Microsoft Clarity behind consent (#313, ADR 0025 §6–7). In the root layout, inside a Suspense (it reads the path):
// - asks with ConsentPrompt where Clarity is set up, until answered, at most three page loads;
// - loads the official tracking code after the page's load event, only with consent and on a page it may record,
//   then sends Consent API v2 (ad storage always denied) and the page's language;
// - masks the whole page (data-clarity-mask on <body>) on a page it must not record, since Clarity, once loaded,
//   stays through client navigations; <NoClarity /> asks for the same on a page the path cannot tell.

const PROMPTS_KEY = "zhaogong:consent-prompts";

/** The official tracking code, written out: a queue until the script from clarity.ms takes over. */
function loadClarity(projectId: string, lang: string) {
  if (!window.clarity) {
    const queue: ClarityFn = (...args: unknown[]) => void (queue.q ??= []).push(args);
    window.clarity = queue;
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${encodeURIComponent(projectId)}`;
    document.head.appendChild(script);
  }
  window.clarity("consentv2", { ad_Storage: "denied", analytics_Storage: "granted" });
  window.clarity("set", "lang", lang);
}

function afterLoad(run: () => void) {
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}

// The answer lives in the zg_consent cookie; writing it sends CONSENT_CHANGED so the page reads it again.
const CONSENT_CHANGED = "zhaogong:consent-changed";
function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGED, onChange);
  return () => window.removeEventListener(CONSENT_CHANGED, onChange);
}
const readConsent = () => parseConsent(document.cookie);
const noConsentOnServer = () => undefined;

// Whether this page load asks by itself, decided (and counted) the first time it is read, then kept for the load.
let autoPrompt: boolean | undefined;
function readAutoPrompt(): boolean {
  if (autoPrompt === undefined) {
    const shown = Number(localStorage.getItem(PROMPTS_KEY) ?? "0") || 0;
    autoPrompt = shouldPrompt(SETUP, readConsent(), shown);
    if (autoPrompt) localStorage.setItem(PROMPTS_KEY, String(shown + 1));
  }
  return autoPrompt;
}
const noPromptOnServer = () => false;
const noSubscription = () => () => {};

export function Analytics() {
  const pathname = useSitePathname();
  const lang = useLang();
  const consent = useSyncExternalStore(subscribeConsent, readConsent, noConsentOnServer);
  const asksByItself = useSyncExternalStore(noSubscription, readAutoPrompt, noPromptOnServer);
  // null: as the page load decided; "settings": opened from 统计设置; "closed": answered or put away.
  const [shown, setShown] = useState<"settings" | "closed" | null>(null);
  const open = shown === "settings" ? "settings" : shown === null && asksByItself ? "auto" : false;
  const loaded = useRef(false);

  useEffect(() => {
    // Decided: the browser tests wait for this before they check that the prompt is not there.
    document.documentElement.dataset.consentChecked = "";
    const reopen = () => setShown("settings");
    window.addEventListener(OPEN_CONSENT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, reopen);
  }, []);

  // Each page: masked whole where it must not be recorded; Clarity loaded where it may, once agreed.
  useEffect(() => {
    if (consent === undefined) return;
    const optedOut = !!window[NO_CLARITY_FLAG] || !!document.querySelector("[data-zg-no-clarity]");
    if (isNoRecordPath(pathname) || optedOut) document.body.setAttribute("data-clarity-mask", "true");
    else document.body.removeAttribute("data-clarity-mask");
    if (!loaded.current && shouldLoadClarity(SETUP, consent, pathname, optedOut)) {
      loaded.current = true;
      afterLoad(() => {
        // Checked again at the last moment: a page's <NoClarity /> may have streamed in after the decision.
        if (window[NO_CLARITY_FLAG] || document.querySelector("[data-zg-no-clarity]")) {
          loaded.current = false;
          return;
        }
        loadClarity(SETUP.projectId!, lang);
      });
    }
  }, [pathname, consent, lang]);

  if (!open || !clarityConfigured(SETUP)) return null;
  return (
    <ConsentPrompt
      consent={consent ?? null}
      fromSettings={open === "settings"}
      onAnswer={(answer) => {
        const wasOn = consent === "clarity";
        document.cookie = consentCookie(answer, location.protocol === "https:");
        window.dispatchEvent(new Event(CONSENT_CHANGED));
        setShown("closed");
        // Clarity cannot be unloaded: clear its cookies, then load the page again without it.
        if (wasOn && answer === "none") {
          window.clarity?.("consent", false);
          location.reload();
        }
      }}
    />
  );
}

function ConsentPrompt({
  consent,
  fromSettings,
  onAnswer,
}: {
  consent: Consent | null;
  fromSettings: boolean;
  onAnswer: (answer: Consent) => void;
}) {
  const t = useMessages(uiMessages).consent;
  const buttons = useRef<HTMLDivElement>(null);
  // Opened from 统计设置: the keyboard goes to 同意. Asking by itself never takes the focus.
  useEffect(() => {
    if (fromSettings) buttons.current?.querySelector("button")?.focus();
  }, [fromSettings]);
  return (
    <section
      aria-label={t.settings}
      className="fixed inset-x-0 bottom-above-nav z-30 px-4 pb-3 md:bottom-4"
      data-clarity-mask="true"
    >
      <div className="mx-auto max-w-3xl space-y-3 rounded-card bg-surface p-4 text-body shadow-card">
        <p>{t.body}</p>
        {consent && <p className="text-meta text-muted">{consent === "clarity" ? t.on : t.off}</p>}
        <div ref={buttons} className="flex gap-2">
          <Button className="flex-1" onClick={() => onAnswer("clarity")}>
            {t.agree}
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => onAnswer("none")}>
            {t.decline}
          </Button>
        </div>
      </div>
    </section>
  );
}
