import type { Message } from "@/components/seeker/chat-client";
import { chatMessages } from "@/i18n/messages/chat";

/** The longest note a chat report keeps; the report dialog's box stops there and counts against it. */
export const CHAT_REPORT_NOTE_MAX = 1000;

/** Why someone reports a chat, in Chinese; a reader's own language comes from the chat dictionary. */
export const CHAT_REPORT_REASONS = chatMessages.zh.reportReasons;
export type ChatReportReason = keyof typeof CHAT_REPORT_REASONS;
export type ChatReport = {
  id: string;
  conversationId: string;
  targetName: string;
  targetRole: "employer" | "seeker";
  reason: ChatReportReason;
  note: string;
  evidence: Message[];
  createdAt: string;
  messageIndex?: number;
};

export function parseChatReport(value: unknown): ChatReport | undefined {
  if (!value || typeof value !== "object") return undefined;
  const input = value as ChatReport;
  if (
    ![input.id, input.conversationId, input.targetName, input.note, input.createdAt].every(
      (value) => typeof value === "string",
    ) ||
    !Object.hasOwn(CHAT_REPORT_REASONS, input.reason) ||
    !["employer", "seeker"].includes(input.targetRole) ||
    input.note.length > CHAT_REPORT_NOTE_MAX ||
    (input.reason === "other" && !input.note.trim()) ||
    !Array.isArray(input.evidence) ||
    input.evidence.length > 100 ||
    !input.evidence.every(
      (message) =>
        message &&
        ["me", "them"].includes(message.from) &&
        typeof message.text === "string" &&
        typeof message.time === "string",
    ) ||
    (input.messageIndex !== undefined && (!Number.isInteger(input.messageIndex) || input.messageIndex < 0))
  )
    return undefined;
  return {
    id: input.id,
    conversationId: input.conversationId,
    targetName: input.targetName,
    targetRole: input.targetRole,
    reason: input.reason,
    note: input.note,
    evidence: input.evidence.map(({ from, text, time }) => ({ from, text, time })),
    createdAt: input.createdAt,
    ...(input.messageIndex !== undefined ? { messageIndex: input.messageIndex } : {}),
  };
}
