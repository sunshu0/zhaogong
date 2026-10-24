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
  task_scam: "fraud",
  ethnic_preference: "discrimination",
};

/** What the platform does not allow, per rule, in words both sides understand. */
function ruleWords(lang: Lang): Record<ChatFinding["rule"], { forbidden: string; caution: string }> {
  const t = pick(chatMessages, lang).warnings;
  return {
    fee: { forbidden: t.feeForbidden, caution: t.feeCaution },
    visa_selling: { forbidden: t.visaSellingForbidden, caution: t.visaSellingCaution },
    task_scam: { forbidden: t.taskScamForbidden, caution: t.taskScamCaution },
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

/** A hint while writing a message that hits the chat rules; `words` is quoted from the message itself. */
export type OutgoingWarning = { before: string; words: string; after: string };

/**
 * A hint while writing a message that hits the chat rules; sending is not blocked. In three parts, so whoever
 * shows it can mark the quoted words as what they are: the writer's own words, not the interface's language.
 */
export function outgoingWarningParts(text: string, lang: Lang = DEFAULT_LANG): OutgoingWarning | undefined {
  return ownWarningParts(text, lang, "outgoingAfter");
}

/**
 * Under a message of one's own once it is sent (#384): the same three parts, saying the other side sees a reminder.
 * Both sides get one, whoever wrote it; the server keeps count only of the business's (ADR 0039).
 */
export function sentWarningParts(text: string, lang: Lang = DEFAULT_LANG): OutgoingWarning | undefined {
  return ownWarningParts(text, lang, "sentAfter");
}

function ownWarningParts(text: string, lang: Lang, ending: "outgoingAfter" | "sentAfter"): OutgoingWarning | undefined {
  const findings = checkChatMessage(text);
  if (!findings.length) return undefined;
  const t = pick(chatMessages, lang).warnings;
  const { quote, joiner } = pick(complianceMessages, lang).words;
  const rules = ruleWords(lang);
  return {
    before: t.outgoingBefore,
    words: [...new Set(findings.flatMap((f) => f.matches))].map((word) => quote(word)).join(joiner),
    after: t[ending](findings.map((f) => rules[f.rule].forbidden).join(t.forbiddenJoiner)),
  };
}

/** The same hint as one line, for anywhere that cannot mark the quoted words. */
export function outgoingWarning(text: string, lang: Lang = DEFAULT_LANG): string | undefined {
  const parts = outgoingWarningParts(text, lang);
  return parts && `${parts.before}${parts.words}${parts.after}`;
}
