// Manual smoke test for AI 发帖 with the real model (#102). Not part of check or e2e: it spends real tokens.
// Usage: ANTHROPIC_API_KEY=... [AI_POST_MODEL=claude-sonnet-5-5] npx tsx scripts/ai-post-smoke.mjs
// It plays a short conversation through the same modelTurn the server uses and prints each answer, the draft,
// what the rules found and the tokens, then says whether 预览并发布 was reached.
import { claudeSend } from "../src/lib/ai-post/model/client.ts";
import { modelTurn, PREVIEW } from "../src/lib/ai-post/model/turn.ts";
import { postingModel } from "../src/lib/ai-post/model/index.ts";
import { startChat } from "../src/lib/ai-post/chat-start.ts";
import { sanitizeDraft } from "../src/components/employer/post-form.ts";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set.");
  process.exit(2);
}

const lines = [
  "Mt Eden 川菜馆招前厅服务员，兼职，时薪 25 到 27，周末晚上，学签可以，要会普通话",
  "英文就叫 Waiter 吧",
  "联系方式不公开，聊天里交换",
  "每周 15 到 25 小时，包工作餐，就这些",
];
const model = postingModel(process.env);
let state = startChat("NZ");
let tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
for (const line of [...lines, PREVIEW]) {
  const turn = await modelTurn(state, line, { send: claudeSend, model, sanitize: (d) => sanitizeDraft(d, "NZ") });
  state = turn.state;
  if (turn.usage) for (const k of Object.keys(tokens)) tokens[k] += turn.usage[k];
  const said = state.messages.at(-1);
  console.log(`\n雇主：${line}\n助手：${said?.text}`);
  if (said?.quickReplies?.length) console.log(`快捷回复：${said.quickReplies.map((q) => q.label).join(" | ")}`);
  if (turn.failed) {
    console.error(`失败：${turn.failed}`);
    process.exit(1);
  }
  if (state.ready) break;
}
console.log(`\n草稿：${JSON.stringify(state.draft, null, 2)}`);
console.log(`\n模型 ${model}，token：${JSON.stringify(tokens)}`);
console.log(state.ready ? "\n到了预览。" : "\n没到预览：看上面的对话，是还缺信息，还是规则拦下了。");
process.exit(state.ready ? 0 : 1);
