// One turn of AI chat posting with a real model (#102, ADR 0018). The model reads the conversation and the draft so
// far and answers with structured JSON (reply.ts); this file keeps what must not depend on it: the employer's words
// are cleaned like any browser input, the compliance rules (R-13) run on every draft the model writes and speak for
// themselves, 预览并发布 is only offered once the job could be published, and a failed call says so plainly.
import type Anthropic from "@anthropic-ai/sdk";
import { checkJob, publishDecision, type Finding, type JobDraft } from "@/lib/compliance";
import { missingFields } from "@/lib/ai-post/parse";
import { CHIP, withMessage, type ChatState } from "@/lib/ai-post/chat-state";
import { applyPatch, readReply, replySchema } from "./reply";
import { contextNote, SYSTEM_PROMPT } from "./prompt";

type Params = Anthropic.Beta.MessageCreateParamsNonStreaming;
type Message = Anthropic.Beta.BetaMessage;

/** Sends one request: the Anthropic client on the server, a fixed-answer fake in tests. */
export type SendMessage = (params: Params) => Promise<Message>;

export interface ModelDeps {
  send: SendMessage;
  model: string;
  /** sanitizeDraft for the country: the model's fields are browser-grade input. */
  sanitize: (draft: unknown) => JobDraft;
  /** Checked just before the call (limits.ts): the words to say instead when the account may not call now. */
  limit?: () => Promise<string | undefined>;
}

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface ModelTurn {
  state: ChatState;
  /** What the call cost, when one was made. */
  usage?: TokenUsage;
  /** Why there is no answer from the model this turn. */
  failed?: "error" | "refused" | "unreadable" | "limited";
}

export const PREVIEW = "预览并发布";
export const UNAVAILABLE =
  "抱歉，AI 发帖助手暂时不可用，刚才这句没能处理。你可以稍后再试，或者点「直接填表」，把招聘内容填进表单发布。";
const REFUSED = "这句话助手处理不了。可以换个说法再试，或者点「直接填表」。";

/** Whether the draft has everything and passes the rules, so 预览并发布 can be offered. */
export function canPreview(draft: JobDraft, findings: Finding[]): boolean {
  return missingFields(draft).length === 0 && publishDecision(findings).canPublish;
}

export async function modelTurn(state: ChatState, message: string, deps: ModelDeps): Promise<ModelTurn> {
  const text = String(message ?? "")
    .trim()
    .slice(0, 2000);
  if (!text) return { state };
  const s = { ...withMessage(state, "employer", text), unavailable: false };
  const before = checkJob(s.draft, s.country, s.employer);

  if (text === PREVIEW && canPreview(s.draft, before))
    return { state: { ...withMessage(s, "assistant", "好，先看看预览。"), ready: true } };

  const limited = await deps.limit?.();
  if (limited) return { state: fail(s, limited), failed: "limited" };

  let response: Message;
  try {
    response = await deps.send(request(s, deps.model, before));
  } catch {
    return { state: fail(s, UNAVAILABLE), failed: "error" };
  }
  const usage = tokenUsage(response);
  if (response.stop_reason === "refusal") return { state: fail(s, REFUSED), usage, failed: "refused" };
  const json = response.content.find((b) => b.type === "text")?.text ?? "";
  const reply = response.stop_reason === "max_tokens" ? undefined : readReply(json);
  if (!reply) return { state: fail(s, UNAVAILABLE), usage, failed: "unreadable" };

  const draft = { ...deps.sanitize(applyPatch(s.draft, reply.draft)), country: s.country };
  const findings = checkJob(draft, s.country, s.employer);
  // The rules have the last word: a problem the model's draft brought in is said in the rule's own words.
  const known = new Set(before.map((f) => `${f.rule}:${f.field}`));
  const added = findings.filter((f) => f.level !== "review" && !known.has(`${f.rule}:${f.field}`));
  const said = [reply.reply, ...added.map((f) => f.message_zh)].join("\n");
  const chips = reply.quickReplies.filter((q) => q !== PREVIEW).slice(0, canPreview(draft, findings) ? 3 : 4);
  if (canPreview(draft, findings)) chips.push(PREVIEW);
  return {
    state: withMessage(
      { ...s, draft },
      "assistant",
      said,
      chips.map((q) => CHIP(q)),
    ),
    usage,
  };
}

function fail(s: ChatState, text: string): ChatState {
  return { ...withMessage(s, "assistant", text), unavailable: true };
}

/**
 * How much of the conversation the model is sent (security review B): the browser may send up to 200 messages of
 * 4,000 characters, and every token is paid for. The draft so far goes with every call (contextNote), so the model
 * does not need the older turns to keep what was agreed.
 */
export const HISTORY_LIMITS = { messages: 30, chars: 12_000 } as const;

/**
 * The latest messages within HISTORY_LIMITS, oldest first, starting with one of the employer's (the model's turns
 * must start with the user's; the greeting is the page's, not the model's). The latest one is always kept.
 */
export function recentHistory<M extends { from: string; text: string }>(messages: readonly M[]): M[] {
  const kept: M[] = [];
  let chars = 0;
  for (let i = messages.length - 1; i >= 0 && kept.length < HISTORY_LIMITS.messages; i -= 1) {
    chars += messages[i].text.length;
    if (kept.length > 0 && chars > HISTORY_LIMITS.chars) break;
    kept.unshift(messages[i]);
  }
  const first = kept.findIndex((m) => m.from === "employer");
  return first < 0 ? [] : kept.slice(first);
}

function request(s: ChatState, model: string, findings: Finding[]): Params {
  // The recent conversation as the model's turns.
  const history: Anthropic.Beta.BetaMessageParam[] = recentHistory(s.messages).map((m) => ({
    role: m.from === "employer" ? "user" : "assistant",
    content: m.text,
  }));
  return {
    model,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: replySchema(s.country) } },
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    // The draft and the rules' findings go last as an operator note, after the employer's latest words.
    messages: [...history, { role: "system", content: contextNote(s.draft, missingFields(s.draft), findings) }],
  };
}

function tokenUsage(response: Message): TokenUsage {
  const u = response.usage;
  return {
    input: u?.input_tokens ?? 0,
    output: u?.output_tokens ?? 0,
    cacheRead: u?.cache_read_input_tokens ?? 0,
    cacheWrite: u?.cache_creation_input_tokens ?? 0,
  };
}
