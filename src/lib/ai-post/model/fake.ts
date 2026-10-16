// A stand-in for the model with fixed answers (#102), for unit tests and the browser tests of the model path. It
// reads the employer's latest words with the rule-based parser and answers in the model's JSON shape, so everything
// around the call (cleaning, the rules, 预览并发布, usage, failures) runs as it does with Claude. Never in production.
// Words that make it fail on purpose: 【测试：出错】 throws like a network error, 【测试：拒绝】 is a refusal.
import type Anthropic from "@anthropic-ai/sdk";
import { englishSummary, missingFields, parsePost } from "@/lib/ai-post/parse";
import type { JobDraft } from "@/lib/compliance";
import { applyPatch, type DraftPatch, type ModelReply } from "./reply";
import type { SendMessage } from "./turn";

const QUESTIONS: Record<string, string> = {
  titleZh: "招的是什么职位？",
  titleEn: "这个职位英文怎么说？",
  industry: "是哪个行业的？",
  employmentType: "是全职、兼职还是临时工？",
  pay: "时薪多少？",
  regionId: "在哪个区？",
  visaAccepted: "接受哪些签证？",
  contact: "联系方式要公开吗？不公开的话求职者在聊天里和你交换。",
};

export const fakeSend: SendMessage = async (params) => {
  const messages = params.messages;
  const note = messages.at(-1);
  const said = [...messages].reverse().find((m) => m.role === "user");
  const words = typeof said?.content === "string" ? said.content : "";
  if (words.includes("【测试：出错】")) throw new Error("fake network error");
  if (words.includes("【测试：拒绝】")) return message("", "refusal");

  const draft = currentDraft(typeof note?.content === "string" ? note.content : "");
  const parsed = (await parsePost(words, "NZ")).draft;
  const patch: DraftPatch = {
    ...(parsed.titleZh && !draft.titleZh && { titleZh: parsed.titleZh }),
    ...(parsed.industry && { industry: parsed.industry }),
    ...(parsed.employmentType?.length && { employmentType: parsed.employmentType }),
    ...(parsed.regionId && { regionId: parsed.regionId }),
    ...(parsed.pay && { payMin: parsed.pay.min, ...(parsed.pay.max != null && { payMax: parsed.pay.max }) }),
    ...(parsed.visaAccepted?.length && { visaAccepted: parsed.visaAccepted }),
    ...(parsed.languages?.length && { languages: parsed.languages }),
    ...(parsed.mealsIncluded && { mealsIncluded: true }),
  };
  // An answer in Latin letters to the English-title question is the English title.
  if (draft.titleZh && !draft.titleEn && /^[A-Za-z][A-Za-z \-/&]*$/.test(words)) patch.titleEn = words;
  if (/不公开|聊天/.test(words)) patch.contactPublic = false;
  let next = applyPatch(draft, patch) as JobDraft;
  if (!draft.descriptionZh && next.titleZh) patch.descriptionZh = `${next.titleZh}。${words}`.slice(0, 300);
  if (next.titleEn) patch.descriptionEn = englishSummary(next, "NZ");
  next = applyPatch(draft, patch) as JobDraft;

  // Like the model, it asks how to give contact details until the employer has chosen.
  const missing = [...missingFields(next), ...(next.contactPublic === undefined ? (["contact"] as const) : [])];
  const ask = missing[0]
    ? (QUESTIONS[missing[0]] ?? "还缺一点信息，能再说说吗？")
    : "都齐了，看看右边的职位卡，没问题就预览并发布。";
  const reply: ModelReply = {
    reply: `收到。${ask}`,
    quickReplies: missing[0] === "contact" ? ["不公开，聊天交换"] : [],
    draft: patch,
  };
  return message(JSON.stringify(reply), "end_turn");
};

function currentDraft(note: string): JobDraft {
  const line = note.split("\n").find((l) => l.startsWith("当前草稿："));
  try {
    return line ? (JSON.parse(line.slice("当前草稿：".length)) as JobDraft) : {};
  } catch {
    return {};
  }
}

function message(text: string, stop: "end_turn" | "refusal"): Anthropic.Beta.BetaMessage {
  return {
    id: "msg_fake",
    type: "message",
    role: "assistant",
    model: "fake",
    content: text ? [{ type: "text", text, citations: null }] : [],
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 120, output_tokens: 40, cache_read_input_tokens: 900, cache_creation_input_tokens: 0 },
  } as unknown as Anthropic.Beta.BetaMessage;
}
