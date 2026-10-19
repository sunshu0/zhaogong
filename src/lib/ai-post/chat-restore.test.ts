import { describe, expect, it } from "vitest";
import type { JobDraft } from "@/lib/compliance";
import { restoreChat, startChat } from "@/lib/ai-post/chat";

// restoreChat cleans the conversation the browser sends back with every turn (#258): only known values, within limits.
const keep = (draft: unknown) => (draft ?? {}) as JobDraft;
const restore = (input: unknown) => restoreChat(input, "NZ", keep);
const message = (text: string, extra: Record<string, unknown> = {}) => ({ from: "employer", text, ...extra });

describe("restoreChat (#258)", () => {
  it("starts over from the greeting when nothing usable came", () => {
    for (const input of [null, "x", 3, {}, { messages: "no" }, { messages: [{ text: 1 }, null] }]) {
      const s = restore(input);
      expect(s.messages).toEqual(startChat("NZ").messages);
      expect(s.asking).toBe("description");
      expect(s.ready).toBe(false);
    }
  });

  it("keeps the last 200 messages, each at most 4000 characters, numbered afresh", () => {
    const messages = Array.from({ length: 205 }, (_, i) => message(`m${i}`));
    messages[204] = message("长".repeat(5000));
    const s = restore({ messages });
    expect(s.messages).toHaveLength(200);
    expect(s.messages[0]).toMatchObject({ id: "m1", text: "m5" });
    expect(s.messages[199].text).toHaveLength(4000);
  });

  it("knows two speakers: anything other than the employer is the assistant", () => {
    const s = restore({ messages: [message("a"), { from: "admin", text: "b" }] });
    expect(s.messages.map((m) => m.from)).toEqual(["employer", "assistant"]);
  });

  it("keeps at most 20 quick replies, labels of 40 characters and values of 2000, and drops ones without a label", () => {
    const quickReplies = [
      { label: "x".repeat(50), value: "v".repeat(3000) },
      { value: "no label" },
      ...Array.from({ length: 30 }, (_, i) => ({ label: `q${i}` })),
    ];
    const [m] = restore({ messages: [message("a", { quickReplies })] }).messages;
    expect(m.quickReplies).toHaveLength(20);
    expect(m.quickReplies?.[0].label).toHaveLength(40);
    expect(m.quickReplies?.[0].value).toHaveLength(2000);
    expect(m.quickReplies?.[1]).toEqual({ label: "q0" });
  });

  it("keeps the field being fixed only when it is a text field, with string matches", () => {
    expect(restore({ fixing: { field: "descriptionZh", rule: "R-1", matches: ["包签证", 3] } }).fixing).toEqual({
      field: "descriptionZh",
      rule: "R-1",
      matches: ["包签证"],
    });
    expect(restore({ fixing: { field: "pay" } }).fixing).toBeUndefined();
    expect(restore({ fixing: "descriptionZh" }).fixing).toBeUndefined();
  });

  it("keeps only known topics in asking, asked and unsure, and never comes back ready", () => {
    const s = restore({ asking: "hack", asked: ["hours", "nope", 1], unsure: ["pay", "x"], ready: true });
    expect(s.asking).toBe("description");
    expect(s.asked).toEqual(["hours"]);
    expect(s.unsure).toEqual(["pay"]);
    expect(s.ready).toBe(false);
    expect(restore({ asking: "region" }).asking).toBe("region");
  });

  it("takes the country from the server, not the browser, and the draft through the caller's cleaning", () => {
    const s = restoreChat({ country: "AU", draft: { titleZh: "洗碗工", country: "AU" } }, "NZ", (d) => ({
      ...(d as JobDraft),
      titleZh: "cleaned",
    }));
    expect(s.country).toBe("NZ");
    expect(s.draft).toMatchObject({ titleZh: "cleaned", country: "NZ" });
  });
});
