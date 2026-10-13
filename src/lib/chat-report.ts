import type { Message } from "@/components/seeker/chat-client";

export const CHAT_REPORT_REASONS = {
  harassment: "骚扰、辱骂或威胁", fraud: "诈骗或虚假信息", fees: "收取押金、介绍费或其他费用",
  privacy: "泄露隐私或冒用身份", discrimination: "歧视或不当招聘要求", illegal: "其他违法或违规行为", other: "其他问题",
};
export type ChatReportReason = keyof typeof CHAT_REPORT_REASONS;
export type ChatReport = { id: string; conversationId: string; targetName: string; targetRole: "employer" | "seeker"; reason: ChatReportReason; note: string; evidence: Message[]; createdAt: string; messageIndex?: number };

export function parseChatReport(value: unknown): ChatReport | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as ChatReport;
  if (![input.id, input.conversationId, input.targetName, input.note, input.createdAt].every((value) => typeof value === "string") ||
    !Object.hasOwn(CHAT_REPORT_REASONS, input.reason) || !["employer", "seeker"].includes(input.targetRole) || input.note.length > 1000 ||
    (input.reason === "other" && !input.note.trim()) || !Array.isArray(input.evidence) || input.evidence.length > 100 ||
    !input.evidence.every((message) => message && ["me", "them"].includes(message.from) && typeof message.text === "string" && typeof message.time === "string") ||
    (input.messageIndex !== undefined && (!Number.isInteger(input.messageIndex) || input.messageIndex < 0))) return undefined;
  return { id: input.id, conversationId: input.conversationId, targetName: input.targetName, targetRole: input.targetRole, reason: input.reason, note: input.note,
    evidence: input.evidence.map(({ from, text, time }) => ({ from, text, time })), createdAt: input.createdAt, ...(input.messageIndex !== undefined ? { messageIndex: input.messageIndex } : {}) };
}
