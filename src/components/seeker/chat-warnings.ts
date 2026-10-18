import { checkChatMessage, type ChatFinding } from "@/lib/compliance";
import type { ChatReportReason } from "@/lib/chat-report";
import { DEFAULT_LANG, type Lang } from "@/i18n/lang";
import { pick } from "@/i18n/messages";
import { chatMessages } from "@/i18n/messages/chat";
import { complianceMessages } from "@/i18n/messages/compliance";

/** Which report reason each chat rule offers; the wording is in the chat dictionary. */
const REPORT_REASONS: Record<ChatFinding["rule"], ChatReportReason> = {
  fee: "fees",
  visa_selling: "illegal",
  ethnic_preference: "discrimination",
};

/** What the platform does not allow, per rule, in words both sides understand. */
function ruleWords(lang: Lang): Record<ChatFinding["rule"], { forbidden: string; caution: string }> {
  const t = pick(chatMessages, lang).warnings;
  return {
    fee: { forbidden: t.feeForbidden, caution: t.feeCaution },
    visa_selling: { forbidden: t.visaSellingForbidden, caution: t.visaSellingCaution },
    ethnic_preference: { forbidden: t.ethnicForbidden, caution: t.ethnicCaution },
  };
}

export type ChatWarning = { rule: ChatFinding["rule"]; text: string; reportReason: ChatReportReason };

/** Reminders under a received message that hits the chat rules (B21's checkChatMessage). */
export function incomingWarnings(text: string, lang: Lang = DEFAULT_LANG): ChatWarning[] {
  const t = pick(chatMessages, lang).warnings;
  const rules = ruleWords(lang);
  return checkChatMessage(text).map(({ rule }) => ({
    rule,
    text: t.incoming(rules[rule].forbidden, rules[rule].caution),
    reportReason: REPORT_REASONS[rule],
  }));
}

/** A hint while writing a message that hits the chat rules; sending is not blocked. */
export function outgoingWarning(text: string, lang: Lang = DEFAULT_LANG): string | undefined {
  const findings = checkChatMessage(text);
  if (!findings.length) return undefined;
  const t = pick(chatMessages, lang).warnings;
  const { quote, joiner } = pick(complianceMessages, lang).words;
  const rules = ruleWords(lang);
  const words = [...new Set(findings.flatMap((f) => f.matches))].map((word) => quote(word)).join(joiner);
  return t.outgoing(words, findings.map((f) => rules[f.rule].forbidden).join(t.forbiddenJoiner));
}
