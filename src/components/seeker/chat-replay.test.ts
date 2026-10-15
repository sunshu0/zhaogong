import { describe, expect, it } from "vitest";
import { buildReplay, firstRoundLength, REPLAY_SCRIPT, type ReplayMessage } from "@/components/seeker/chat-replay";

describe("buildReplay", () => {
  it("is a real conversation from startChat / nextTurn: the script's messages in turn with the assistant", async () => {
    const replay = await buildReplay();
    expect(replay.length).toBe(1 + REPLAY_SCRIPT.length * 2);
    replay.forEach((m, i) => expect(m.from).toBe(i % 2 === 0 ? "assistant" : "employer"));
    expect(replay.filter((m) => m.from === "employer").map((m) => m.text)).toEqual(REPLAY_SCRIPT);
  });

  it("is the same every time", async () => {
    expect(await buildReplay()).toEqual(await buildReplay());
  });

  it("points out the three problems in the post and ends with everything filled in", async () => {
    const assistant = (await buildReplay()).filter((m) => m.from === "assistant").map((m) => m.text);
    expect(assistant.some((t) => t.includes("低于新西兰最低工资"))).toBe(true);
    expect(assistant.some((t) => t.includes("押金"))).toBe(true);
    expect(assistant.some((t) => t.includes("限华人"))).toBe(true);
    expect(assistant.at(-1)).toContain("都齐了");
  });

  it("keeps quick replies as plain labels", async () => {
    const withChips = (await buildReplay()).filter((m) => m.quickReplies.length > 0);
    expect(withChips.length).toBeGreaterThan(0);
    for (const m of withChips) for (const label of m.quickReplies) expect(typeof label).toBe("string");
  });
});

describe("firstRoundLength", () => {
  const m = (from: ReplayMessage["from"]): ReplayMessage => ({
    id: String(Math.random()),
    from,
    text: "",
    quickReplies: [],
  });

  it("is the greeting, the employer's first message and the assistant's reply", async () => {
    expect(firstRoundLength(await buildReplay())).toBe(3);
    expect(firstRoundLength([m("employer"), m("assistant"), m("employer")])).toBe(2);
  });

  it("is the whole conversation when it has no full round", () => {
    expect(firstRoundLength([m("assistant")])).toBe(1);
    expect(firstRoundLength([m("assistant"), m("employer")])).toBe(2);
    expect(firstRoundLength([])).toBe(0);
  });
});
