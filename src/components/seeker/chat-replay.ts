// The landing page's replay of an AI chat post. Not a script of replies: the employer's side below is run
// through line B's startChat / nextTurn (src/lib/ai-post/chat.ts), which is deterministic, so the replay is
// whatever the real assistant says today.
import { nextTurn, startChat } from "@/lib/ai-post";

/** The employer's messages: a post with three problems (pay below the minimum wage, a deposit, 限华人), then the fixes. */
export const REPLAY_SCRIPT = [
  "奶茶店招兼职店员，市中心，时薪 18，入职交押金200，限华人。学签OK。微信 cbdtea_demo",
  "24",
  "删掉这句",
  "改成「需会普通话」",
  "不固定",
  "都不包",
];

export interface ReplayMessage {
  id: string;
  from: "assistant" | "employer";
  text: string;
  quickReplies: string[];
}

export async function buildReplay(script: string[] = REPLAY_SCRIPT): Promise<ReplayMessage[]> {
  let state = startChat("NZ");
  for (const message of script) state = await nextTurn(state, message);
  return state.messages.map((m) => ({
    id: m.id,
    from: m.from,
    text: m.text,
    quickReplies: (m.quickReplies ?? []).map((q) => q.label),
  }));
}

/**
 * How many messages make the first round — up to the assistant's reply to the employer's first message. They
 * show before the replay starts, so the window is never a blank box (A31).
 */
export function firstRoundLength(messages: readonly ReplayMessage[]): number {
  const employer = messages.findIndex((m) => m.from === "employer");
  if (employer < 0) return messages.length;
  const reply = messages.findIndex((m, i) => i > employer && m.from === "assistant");
  return reply < 0 ? messages.length : reply + 1;
}
