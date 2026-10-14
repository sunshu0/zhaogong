// The chat's state and messages, and the small pure helpers every part of the chat uses.
import type { Finding, JobDraft, PostingEmployer, RuleId } from "@/lib/compliance";
import type { CountryCode } from "@/lib/types";

export type Topic =
  | "description"
  | "rewrite"
  | "fix"
  | "title"
  | "titleEn"
  | "industry"
  | "pay"
  | "hours"
  | "region"
  | "employmentType"
  | "visa"
  | "perks"
  | "contact"
  | "review";

export interface QuickReply {
  label: string;
  /** Sent as the employer's message; the label when not set. */
  value?: string;
}

export interface ChatMessage {
  id: string;
  from: "assistant" | "employer";
  text: string;
  quickReplies?: QuickReply[];
}

export interface ChatState {
  country: CountryCode;
  /** Who is posting, set by the server each turn (never taken from the browser); unknown on the landing page. */
  employer?: PostingEmployer;
  draft: JobDraft;
  messages: ChatMessage[];
  /** What the assistant is waiting for. */
  asking: Topic;
  /** The finding being fixed (asking "fix") or the text field being rewritten (asking "rewrite"). */
  fixing?: { rule?: RuleId; field: TextField; matches?: string[] };
  /** Optional items (hours, meals, visas) the employer has answered or skipped, so they are not asked again. */
  asked: Topic[];
  /** Things filled in by a guess that the employer should confirm. */
  unsure: Topic[];
  /** Review-level findings already mentioned. */
  noted: string[];
  /** The employer chose 预览并发布. */
  ready: boolean;
}

export type TextField = "titleZh" | "titleEn" | "descriptionZh" | "shiftsZh" | "address";

export const TOPICS: Topic[] = [
  "description",
  "rewrite",
  "fix",
  "title",
  "titleEn",
  "industry",
  "pay",
  "hours",
  "region",
  "employmentType",
  "visa",
  "perks",
  "contact",
  "review",
];

export const TEXT_FIELDS: TextField[] = ["titleZh", "titleEn", "descriptionZh", "shiftsZh", "address"];

export const CHIP = (label: string, value?: string): QuickReply => (value ? { label, value } : { label });

export const key = (f: Finding) => `${f.rule}:${f.field}`;

export function clone(s: ChatState): ChatState {
  return {
    ...s,
    draft: { ...s.draft, ...(s.draft.contact && { contact: { ...s.draft.contact } }) },
    messages: [...s.messages],
    asked: [...s.asked],
    unsure: [...s.unsure],
    noted: [...s.noted],
    ...(s.fixing && { fixing: { ...s.fixing } }),
  };
}

export function withMessage(
  state: ChatState,
  from: ChatMessage["from"],
  text: string,
  quickReplies?: QuickReply[],
): ChatState {
  const s = clone(state);
  const msg: ChatMessage = {
    id: `m${s.messages.length + 1}`,
    from,
    text,
    ...(quickReplies?.length && { quickReplies }),
  };
  s.messages.push(msg);
  return s;
}
