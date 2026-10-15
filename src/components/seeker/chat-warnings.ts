import { checkChatMessage, type ChatFinding } from "@/lib/compliance";
import type { ChatReportReason } from "@/lib/chat-report";

/** What the platform does not allow, per rule, in words both sides understand. */
const RULES: Record<ChatFinding["rule"], { forbidden: string; reportReason: ChatReportReason; caution: string }> = {
  fee: {
    forbidden: "找工不允许向求职者收取押金或任何费用",
    caution: "请谨慎，不要先付钱；可以举报。",
    reportReason: "fees",
  },
  visa_selling: {
    forbidden: "找工不允许用办签证、包工签或包身份招人",
    caution: "请谨慎，可以举报。",
    reportReason: "illegal",
  },
  ethnic_preference: {
    forbidden: "找工不允许按种族或国籍招人",
    caution: "请谨慎，可以举报。",
    reportReason: "discrimination",
  },
};

export type ChatWarning = { rule: ChatFinding["rule"]; text: string; reportReason: ChatReportReason };

/** Reminders under a received message that hits the chat rules (B21's checkChatMessage). */
export function incomingWarnings(text: string): ChatWarning[] {
  return checkChatMessage(text).map(({ rule }) => ({
    rule,
    text: `${RULES[rule].forbidden}。${RULES[rule].caution}`,
    reportReason: RULES[rule].reportReason,
  }));
}

/** A hint while writing a message that hits the chat rules; sending is not blocked. */
export function outgoingWarning(text: string): string | undefined {
  const findings = checkChatMessage(text);
  if (!findings.length) return undefined;
  const words = [...new Set(findings.flatMap((f) => f.matches))].map((w) => `「${w}」`).join("");
  return `这条消息提到${words}：${findings.map((f) => RULES[f.rule].forbidden).join("；")}，建议修改后再发。`;
}
