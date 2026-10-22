import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { sanitizeDraft } from "@/components/employer/post-form";
import { startChat } from "@/lib/ai-post/chat-start";
import type { ChatState } from "@/lib/ai-post/chat-state";
import { assistantKind, DEFAULT_MODEL, postingModel, postingTurn, PREVIEW, UNAVAILABLE } from "./index";
import { fakeSend } from "./fake";
import { applyPatch, readReply, replySchema } from "./reply";
import { HISTORY_LIMITS, modelTurn, recentHistory, type SendMessage } from "./turn";

const sanitize = (d: unknown) => sanitizeDraft(d, "NZ");
type Params = Anthropic.Beta.MessageCreateParamsNonStreaming;

/** A send that answers with one fixed JSON reply and remembers the request. */
function answering(reply: object, seen: Params[] = []): SendMessage {
  return async (params) => {
    seen.push(params);
    return {
      content: [{ type: "text", text: JSON.stringify(reply) }],
      stop_reason: "end_turn",
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 800, cache_creation_input_tokens: 0 },
    } as unknown as Anthropic.Beta.BetaMessage;
  };
}

const say = async (s: ChatState, text: string, send: SendMessage = fakeSend) =>
  (await modelTurn(s, text, { send, model: "m", sanitize })).state;

describe("which assistant answers (#102)", () => {
  it("is Claude in production with a key and unavailable without one, never the script", () => {
    expect(assistantKind({ NODE_ENV: "production", ANTHROPIC_API_KEY: "k" })).toBe("claude");
    expect(assistantKind({ NODE_ENV: "production" })).toBe("unavailable");
    expect(assistantKind({ NODE_ENV: "production", AI_POST_FAKE: "1" }, true)).toBe("unavailable");
  });

  it("outside production is the script unless the model or the fake is asked for", () => {
    expect(assistantKind({ NODE_ENV: "development" })).toBe("script");
    expect(assistantKind({ NODE_ENV: "development", ANTHROPIC_API_KEY: "k" })).toBe("script");
    expect(assistantKind({ NODE_ENV: "development", ANTHROPIC_API_KEY: "k", AI_POST_LIVE: "1" })).toBe("claude");
    expect(assistantKind({ NODE_ENV: "test" }, true)).toBe("fake");
    expect(assistantKind({ NODE_ENV: "test", AI_POST_FAKE: "1" })).toBe("fake");
  });

  it("uses claude-sonnet-5-5 unless AI_POST_MODEL names another", () => {
    expect(postingModel({})).toBe(DEFAULT_MODEL);
    expect(DEFAULT_MODEL).toBe("claude-sonnet-5-5");
    expect(postingModel({ AI_POST_MODEL: " claude-opus-5-5 " })).toBe("claude-opus-5-5");
  });

  it("unavailable keeps the employer's words and says so", async () => {
    const turn = await postingTurn(startChat("NZ"), "招服务员", {
      kind: "unavailable",
      model: "m",
      claude: fakeSend,
      sanitize,
    });
    expect(turn.state.messages.at(-2)?.text).toBe("招服务员");
    expect(turn.state.messages.at(-1)?.text).toBe(UNAVAILABLE);
    expect(turn.state.unavailable).toBe(true);
  });
});

describe("a turn with the model", () => {
  it("sends the conversation from the employer's first words, the draft as a closing note, cached instructions", async () => {
    const seen: Params[] = [];
    await say(startChat("NZ"), "招前厅服务员", answering({ reply: "时薪多少？", quickReplies: [], draft: {} }, seen));
    const params = seen[0];
    expect(params.model).toBe("m");
    expect(params.fallbacks).toBe("default");
    expect(params.betas).toEqual(["server-side-fallback-2026-07-01"]);
    expect(params.messages[0]).toEqual({ role: "user", content: "招前厅服务员" });
    expect(params.messages.at(-1)?.role).toBe("system");
    expect(String(params.messages.at(-1)?.content)).toContain("还缺的必填项：titleZh");
    expect(JSON.stringify(params.system)).toContain('"cache_control":{"type":"ephemeral"}');
    expect(params.output_config?.format?.type).toBe("json_schema");
  });

  it("fills the draft from the reply, cleaned like browser input", async () => {
    const s = await say(
      startChat("NZ"),
      "招前厅服务员",
      answering({
        reply: "好的，时薪多少？",
        quickReplies: ["$25", "$27"],
        draft: {
          titleZh: "前厅服务员",
          industry: "mining",
          regionId: "akl-cbd",
          payMin: 26,
          roles: ["front_of_house"],
        },
      }),
    );
    expect(s.draft).toMatchObject({ titleZh: "前厅服务员", regionId: "akl-cbd", pay: { min: 26 } });
    expect(s.draft.industry).toBeUndefined(); // not an industry the app knows
    expect(s.messages.at(-1)).toMatchObject({ from: "assistant", text: "好的，时薪多少？" });
    expect(s.messages.at(-1)?.quickReplies?.map((q) => q.label)).toEqual(["$25", "$27"]);
  });

  it("lets the rules speak when the model writes in something against them, and holds back 预览并发布", async () => {
    const s = await say(
      startChat("NZ"),
      "时薪 18",
      answering({ reply: "好的。", quickReplies: [PREVIEW], draft: { payMin: 18 } }),
    );
    const last = s.messages.at(-1)!;
    expect(last.text).toContain("低于新西兰成人最低工资");
    expect(last.quickReplies?.map((q) => q.label) ?? []).not.toContain(PREVIEW);
  });

  it("with the fake, goes from a message to 预览并发布 and the preview", async () => {
    let s = await say(startChat("NZ"), "Mt Eden 川菜馆招前厅服务员，时薪 $25-27，兼职，学签可做，需会普通话");
    expect(s.messages.at(-1)?.text).toContain("英文怎么说");
    s = await say(s, "Waiter");
    expect(s.messages.at(-1)?.text).toContain("联系方式要公开吗");
    s = await say(s, "不公开，聊天交换");
    expect(s.messages.at(-1)?.text).toContain("都齐了");
    expect(s.messages.at(-1)?.quickReplies?.map((q) => q.label)).toContain(PREVIEW);
    s = await say(s, PREVIEW);
    expect(s.ready).toBe(true);
  });

  it("says plainly that it is unavailable when the call fails, is refused or cannot be read", async () => {
    const turn = await modelTurn(startChat("NZ"), "【测试：出错】", { send: fakeSend, model: "m", sanitize });
    expect(turn).toMatchObject({ failed: "error", state: { unavailable: true } });
    expect(turn.state.messages.at(-1)?.text).toBe(UNAVAILABLE);
    const refused = await modelTurn(startChat("NZ"), "【测试：拒绝】", { send: fakeSend, model: "m", sanitize });
    expect(refused.failed).toBe("refused");
    const garbled: SendMessage = async () =>
      ({
        content: [{ type: "text", text: "{not json" }],
        stop_reason: "end_turn",
      }) as unknown as Anthropic.Beta.BetaMessage;
    expect((await modelTurn(startChat("NZ"), "招人", { send: garbled, model: "m", sanitize })).failed).toBe(
      "unreadable",
    );
  });

  it("reports the tokens a call used", async () => {
    const turn = await modelTurn(startChat("NZ"), "招人", {
      send: answering({ reply: "招什么职位？", quickReplies: [], draft: {} }),
      model: "m",
      sanitize,
    });
    expect(turn.usage).toEqual({ input: 10, output: 5, cacheRead: 800, cacheWrite: 0 });
  });
});

describe("the reply's shape", () => {
  it("stays within structured outputs' limits: at most 24 optional fields, no unions", () => {
    const schema = replySchema("NZ");
    const optional = Object.keys(schema.properties.draft.properties).length;
    expect(optional).toBeLessThanOrEqual(24);
    expect(JSON.stringify(schema)).not.toMatch(/anyOf|"type":\[/);
  });

  it("reads only a reply with something to say, and at most four quick replies", () => {
    expect(readReply("")).toBeUndefined();
    expect(readReply('{"reply":"  ","quickReplies":[],"draft":{}}')).toBeUndefined();
    expect(readReply('{"reply":"好","quickReplies":["a","b","c","d","e",""],"draft":{}}')?.quickReplies).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("maps the flat fields onto the draft", () => {
    expect(
      applyPatch({ contact: { wechat: "old" } }, { payMin: 25, payMax: 27, hoursMin: 20, phone: "021 000" }),
    ).toMatchObject({
      pay: { min: 25, max: 27 },
      hoursPerWeek: { min: 20 },
      contact: { wechat: "old", phone: "021 000" },
    });
  });
});

describe("the conversation the model is sent (security review B)", () => {
  const say = (from: "employer" | "assistant", text: string) => ({ from, text });

  it("is at most the last 30 messages, starting with one of the employer's", () => {
    const chat = Array.from({ length: 200 }, (_, i) => say(i % 2 ? "assistant" : "employer", `第 ${i} 句`));
    const sent = recentHistory(chat);
    expect(sent.length).toBeLessThanOrEqual(HISTORY_LIMITS.messages);
    expect(sent.at(-1)).toBe(chat.at(-1));
    expect(sent[0].from).toBe("employer");
  });

  it("stops at 12,000 characters, but always keeps the latest message", () => {
    const long = "字".repeat(4000);
    const chat = [say("employer", long), say("assistant", long), say("employer", long), say("assistant", long)];
    const sent = recentHistory([...chat, say("employer", "时薪 25")]);
    expect(sent.reduce((n, m) => n + m.text.length, 0)).toBeLessThanOrEqual(HISTORY_LIMITS.chars);
    expect(sent.at(-1)?.text).toBe("时薪 25");
    expect(sent[0].from).toBe("employer");
    expect(recentHistory([say("employer", "字".repeat(20_000))])).toHaveLength(1);
  });

  it("sends the model only that much", async () => {
    let sent = 0;
    const send: SendMessage = async (params) => {
      sent = params.messages.filter((m) => m.role !== "system").length;
      return fakeSend(params);
    };
    let state = startChat("NZ");
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `x${i}`,
      from: i % 2 ? "assistant" : "employer",
      text: "好",
    }));
    state = { ...state, messages: [...state.messages, ...(many as ChatState["messages"])] };
    await modelTurn(state, "时薪 25", { send, model: "m", sanitize: (d) => sanitizeDraft(d, "NZ") });
    expect(sent).toBeLessThanOrEqual(HISTORY_LIMITS.messages);
    expect(sent).toBeGreaterThan(0);
  });
});
