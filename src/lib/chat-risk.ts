// 聊天风险 (#384, ADR 0039): when a business's chat messages that hit the chat rules (lib/compliance, the same words
// the chat warns about) become an item for moderators. Pure: the records are in src/db/chat-risk.ts.
import { checkChatMessage, type ChatFinding } from "@/lib/compliance";

export type ChatRiskRule = ChatFinding["rule"];

/** How many of a business's messages within CHAT_RISK_WINDOW_DAYS open an item. */
export const CHAT_RISK_THRESHOLD = 3;
export const CHAT_RISK_WINDOW_DAYS = 7;
/** How long each message's record is kept; an item shows what is still kept. */
export const CHAT_RISK_KEEP_DAYS = 90;

const DAY_MS = 86_400_000;

/** The kinds of rule a business's message hits, in rule order; empty when it is fine. */
export function chatRiskRules(text: string): ChatRiskRule[] {
  return checkChatMessage(text).map((finding) => finding.rule);
}

/**
 * Whether a business's records open an item now (when none is open): at least CHAT_RISK_THRESHOLD records are
 * within the last CHAT_RISK_WINDOW_DAYS and after the item before was closed (`since`), so closing one starts the
 * count again.
 */
export function opensItem(hitTimes: readonly string[], since: string | null, now: Date): boolean {
  const from = Math.max(now.getTime() - CHAT_RISK_WINDOW_DAYS * DAY_MS, since ? Date.parse(since) : -Infinity);
  return hitTimes.filter((at) => Date.parse(at) > from).length >= CHAT_RISK_THRESHOLD;
}

/** Records older than this are deleted. */
export function keptFrom(now: Date): string {
  return new Date(now.getTime() - CHAT_RISK_KEEP_DAYS * DAY_MS).toISOString();
}
