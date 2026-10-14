// AI chat posting, stage one: a deterministic assistant behind nextTurn(state, message), the
// interface a real model call replaces later. It asks one thing at a time — what is missing, what it
// only guessed, and what the compliance check objects to — and fills the draft as answers come in.
// Same state and message in, same state out: the landing page replays real conversations with it.
import { clone, withMessage, type ChatState } from "./chat-state";
import { answer } from "./chat-answers";
import { askAbout, proceed, question } from "./chat-questions";
import { CHANGE_PROMPTS, changeIntent, reopen } from "./chat-change";

export type { ChatMessage, ChatState, QuickReply, Topic } from "./chat-state";
export { restoreChat } from "./chat-restore";
export { SAMPLE_POST, startChat } from "./chat-start";

/** One turn: the employer's message in, the assistant's reply (and the updated draft) out. */
export async function nextTurn(state: ChatState, message: string): Promise<ChatState> {
  const text = String(message ?? "")
    .trim()
    .slice(0, 2000);
  if (!text) return state;
  const s = withMessage(state, "employer", text);

  const change =
    s.asking === "description" || s.asking === "rewrite" || s.asking === "fix" ? undefined : changeIntent(text);
  if (change) {
    if (change.value) {
      const done = await answer(s, change.topic, change.value);
      if (done.ok) return proceed(done.state, done.ack);
    }
    return askAbout(reopen(s, change.topic), change.topic, CHANGE_PROMPTS[change.topic]);
  }

  const done = await answer(s, s.asking, text);
  if (!done.ok) return askAbout(s, s.asking, done.retry);
  if (done.state.ready) return withMessage(done.state, "assistant", done.ack);
  return proceed(done.state, done.ack);
}

/** Back from the preview to the conversation: ready again for changes. */
export function resumeChat(state: ChatState): ChatState {
  const s = { ...clone(state), ready: false, asking: "review" as const };
  const q = question(s, "review");
  return withMessage(s, "assistant", "还要改哪里？直接说，比如「改一下时薪」，或者点「预览并发布」。", q.quickReplies);
}
