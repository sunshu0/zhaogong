// Which posting assistant answers (#102, ADR 0018), and one turn with it. Production has only the model: without a
// key it is unavailable and says so, never the script in its place. Development and tests keep the rule-based
// script (labelled on the page) unless asked for the model, and the fixed-answer fake for the model path's tests.
import { nextTurn } from "@/lib/ai-post/chat";
import { withMessage, type ChatState } from "@/lib/ai-post/chat-state";
import type { JobDraft } from "@/lib/compliance";
import { fakeSend } from "./fake";
import { modelTurn, UNAVAILABLE, type ModelTurn, type SendMessage } from "./turn";

export type AssistantKind = "claude" | "script" | "fake" | "unavailable";

export const DEFAULT_MODEL = "claude-sonnet-5-5";
/** Set by a browser test (outside production only) to talk to the fake model on a shared dev server. */
export const FAKE_COOKIE = "zg_ai_fake";

type Env = Record<string, string | undefined>;

export function assistantKind(env: Env, fakeCookie = false): AssistantKind {
  const production = env.NODE_ENV === "production";
  const hasKey = !!env.ANTHROPIC_API_KEY?.trim();
  if (production) return hasKey ? "claude" : "unavailable";
  if (fakeCookie || env.AI_POST_FAKE === "1") return "fake";
  // A developer's machine may hold a key for other things: the model is used only when asked for.
  return hasKey && env.AI_POST_LIVE === "1" ? "claude" : "script";
}

export function postingModel(env: Env): string {
  return env.AI_POST_MODEL?.trim() || DEFAULT_MODEL;
}

export interface TurnDeps {
  kind: AssistantKind;
  model: string;
  /** The Anthropic client's send; only called for "claude". */
  claude: SendMessage;
  sanitize: (draft: unknown) => JobDraft;
}

export async function postingTurn(state: ChatState, message: string, deps: TurnDeps): Promise<ModelTurn> {
  switch (deps.kind) {
    case "script":
      return { state: await nextTurn(state, message) };
    case "unavailable": {
      const text = String(message ?? "").trim();
      if (!text) return { state };
      const s = withMessage(state, "employer", text.slice(0, 2000));
      return { state: { ...withMessage(s, "assistant", UNAVAILABLE), unavailable: true }, failed: "error" };
    }
    case "fake":
      return modelTurn(state, message, { send: fakeSend, model: "fake", sanitize: deps.sanitize });
    case "claude":
      return modelTurn(state, message, { send: deps.claude, model: deps.model, sanitize: deps.sanitize });
  }
}

export { PREVIEW, UNAVAILABLE, type ModelTurn, type SendMessage, type TokenUsage } from "./turn";
